#!/usr/bin/env node
/**
 * سكريبت رفع الكود إلى GitHub
 * يستخدم Replit GitHub Connector للمصادقة التلقائية
 *
 * الاستخدام:
 *   node scripts/push-to-github.mjs "رسالة التعديل"
 *
 * يرفع كل الملفات المعدّلة مقارنةً بـ origin/main إلى مستودع GitHub
 */

import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { ReplitConnectors } from "@replit/connectors-sdk";

const OWNER = "rrakann528";
const REPO = "LrmTV";
const BRANCH = "main";
const MSG = process.argv[2] || "تحديث من Replit";

const connectors = new ReplitConnectors();

async function ghAPI(endpoint, options = {}) {
  const res = await connectors.proxy("github", endpoint, options);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API error ${res.status} on ${endpoint}: ${body}`);
  }
  return res.json();
}

async function getFileSha(path) {
  try {
    const data = await ghAPI(`/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}`);
    return data.sha;
  } catch {
    return null;
  }
}

async function pushFile(filePath) {
  if (!existsSync(filePath)) {
    console.log(`  ⏭ تخطي (محذوف أو غير موجود): ${filePath}`);
    return;
  }
  const content = readFileSync(filePath);
  const base64Content = content.toString("base64");
  const sha = await getFileSha(filePath);

  const body = {
    message: MSG,
    content: base64Content,
    branch: BRANCH,
    ...(sha ? { sha } : {}),
  };

  await ghAPI(`/repos/${OWNER}/${REPO}/contents/${filePath}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  console.log(`  ✅ ${filePath}`);
}

async function main() {
  console.log(`\n🚀 رفع التحديثات إلى ${OWNER}/${REPO} (${BRANCH})\n`);
  console.log(`📝 رسالة: ${MSG}\n`);

  // جلب الملفات المعدّلة والجديدة مقارنةً بـ origin/main
  let changedFiles = [];
  try {
    const gitOutput = execSync(
      `git diff --name-only origin/main HEAD && git diff --name-only HEAD`,
      { encoding: "utf8" }
    ).trim();

    const stagedOutput = execSync(
      `git diff --cached --name-only`,
      { encoding: "utf8" }
    ).trim();

    const untrackedOutput = execSync(
      `git ls-files --others --exclude-standard`,
      { encoding: "utf8" }
    ).trim();

    const allFiles = [
      ...gitOutput.split("\n"),
      ...stagedOutput.split("\n"),
      ...untrackedOutput.split("\n"),
    ]
      .map((f) => f.trim())
      .filter(Boolean);

    changedFiles = [...new Set(allFiles)];
  } catch {
    console.error("❌ خطأ في قراءة الملفات المعدّلة من git");
    process.exit(1);
  }

  if (changedFiles.length === 0) {
    console.log("✨ لا توجد تغييرات للرفع.");
    return;
  }

  console.log(`📂 الملفات المعدّلة (${changedFiles.length}):`);
  changedFiles.forEach((f) => console.log(`   - ${f}`));
  console.log();

  let success = 0;
  let failed = 0;

  for (const file of changedFiles) {
    try {
      await pushFile(file);
      success++;
    } catch (err) {
      console.error(`  ❌ فشل رفع ${file}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ تم رفع ${success} ملف بنجاح`);
  if (failed > 0) console.log(`❌ فشل رفع ${failed} ملف`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

main().catch((err) => {
  console.error("❌ خطأ غير متوقع:", err.message);
  process.exit(1);
});
