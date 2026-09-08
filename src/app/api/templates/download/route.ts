import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember, getManagedGroupIds } from "@/lib/auth";
import * as XLSX from "xlsx";

// GET /api/templates/download?type=tasks|schedules
// Generates and returns an Excel template file with Persian column headers
// and (optionally) pre-filled dropdown values (group names, member handles, etc.)
export async function GET(req: NextRequest) {
  try {
    const me = await getCurrentMember();
    if (!me) {
      return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
    }

    if (me.role === "SPECIALIST") {
      return NextResponse.json(
        { error: "کارشناس مجاز به دریافت تمپلت نیست." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "tasks";

    // Fetch reference data
    const groups = await db.orgGroup.findMany({
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    });

    const members = await db.member.findMany({
      select: { id: true, name: true, handle: true, role: true, groupId: true },
      orderBy: { name: "asc" },
    });

    // Filter members based on role
    let visibleMembers = members;
    const myManagedGroupIds = me.role === "MANAGER" ? getManagedGroupIds(me) : [];
    if (me.role === "MANAGER" && myManagedGroupIds.length > 0) {
      visibleMembers = members.filter((m) => myManagedGroupIds.includes(m.groupId ?? ""));
    }

    const workbook = XLSX.utils.book_new();

    if (type === "schedules") {
      // ---- SCHEDULE TEMPLATE ----
      const groupNames = groups
        .filter((g) => me.role === "MANAGER" ? myManagedGroupIds.includes(g.id) : true)
        .map((g) => g.name);

      const memberHandles = visibleMembers.map((m) => m.handle);

      const headerRow = [
        "نام تسک",
        "نام مجموعه",
        "هندل مسئول",
        "روز هفته",
        "ساعت شروع",
        "ساعت پایان",
      ];

      // Instructions row
      const instructionsRow = [
        "مثال: گزارش روزانه",
        groupNames.join(" | "),
        memberHandles.join(" | "),
        "شنبه | یکشنبه | دوشنبه | سه‌شنبه | چهارشنبه | پنجشنبه | جمعه",
        "مثال: 08:00",
        "مثال: 09:30",
      ];

      // Sample data row
      const sampleRow = [
        groupNames[0] ? "نام تسک نمونه" : "",
        groupNames[0] || "",
        memberHandles[0] || "",
        "شنبه",
        "09:00",
        "10:00",
      ];

      const wsData = [headerRow, instructionsRow, sampleRow];
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Set column widths
      ws["!cols"] = [
        { wch: 25 }, // نام تسک
        { wch: 25 }, // نام مجموعه
        { wch: 18 }, // هندل مسئول
        { wch: 22 }, // روز هفته
        { wch: 12 }, // ساعت شروع
        { wch: 12 }, // ساعت پایان
      ];

      XLSX.utils.book_append_sheet(workbook, ws, "زمان‌بندی");

    } else {
      // ---- TASKS TEMPLATE ----
      const groupNames = groups
        .filter((g) => me.role === "MANAGER" ? myManagedGroupIds.includes(g.id) : true)
        .map((g) => g.name);

      const memberHandles = visibleMembers.map((m) => m.handle);

      const headerRow = [
        "عنوان تسک",
        "توضیحات",
        "نام مجموعه",
        "هندل مسئول",
        "اولویت",
        "مهلت شمسی (YYYY-MM-DD)",
        "ساعت شروع (اختیاری)",
        "منبع",
        "لینک (اختیاری)",
        "شماره نامه (اختیاری)",
        "تاریخ نامه شمسی (YYYY-MM-DD) (اختیاری)",
        "هندل مرجع (اختیاری)",
      ];

      const instructionsRow = [
        "مثال: تهیه گزارش",
        "توضیحات اختیاری",
        groupNames.join(" | "),
        memberHandles.join(" | "),
        "بالا | متوسط | پایین",
        "مثال: 1404-03-15",
        "مثال: 08:00",
        "دستی | ارجاع نامه\u200Cای",
        "https://example.com",
        "مثال: 12345",
        "1404-03-10",
        "هندل عضو مرجع",
      ];

      const sampleRow = [
        "تسک نمونه",
        "",
        groupNames[0] || "",
        memberHandles[0] || "",
        "متوسط",
        "1404-12-29",
        "",
        "دستی",
        "",
        "",
        "",
        "",
      ];

      const wsData = [headerRow, instructionsRow, sampleRow];
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      ws["!cols"] = [
        { wch: 25 }, // عنوان تسک
        { wch: 30 }, // توضیحات
        { wch: 22 }, // نام مجموعه
        { wch: 18 }, // هندل مسئول
        { wch: 12 }, // اولویت
        { wch: 20 }, // مهلت
        { wch: 20 }, // ساعت شروع
        { wch: 18 }, // منبع
        { wch: 25 }, // لینک
        { wch: 18 }, // شماره نامه
        { wch: 22 }, // تاریخ نامه
        { wch: 18 }, // هندل مرجع
      ];

      XLSX.utils.book_append_sheet(workbook, ws, "تسک‌ها");
    }

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    const filename = type === "schedules"
      ? "تمپلت-زمانبندی.xlsx"
      : "تمپلت-تسک.xlsx";

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (error) {
    console.error("Template download error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}