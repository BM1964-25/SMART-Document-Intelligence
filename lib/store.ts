import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export type RiskLevel = "Gruen" | "Gelb" | "Rot";
export type ConnectorStatus = "Aktiv" | "Bereit" | "Fehler";

export type FolderConnector = {
  id: string;
  name: string;
  path: string;
  status: ConnectorStatus;
  lastScan?: string;
  documentsFound: number;
  error?: string;
};

export type StoredDocument = {
  id: string;
  title: string;
  fileName: string;
  filePath: string;
  extension: string;
  size: number;
  modifiedAt: string;
  type: string;
  project: string;
  owner: string;
  date: string;
  risk: RiskLevel;
  priority: "Hoch" | "Mittel" | "Normal";
  status: "Analysiert" | "In Pruefung" | "Offen";
  summary: string;
  risks: string[];
  tasks: string[];
  deadlines: string[];
  nextStep: string;
  extractedText: string;
  sourceConnectorId?: string;
};

export type AppData = {
  connectors: FolderConnector[];
  documents: StoredDocument[];
  auditTrail: string[];
};

const dataDir = path.join(process.cwd(), ".smart-di");
const dataFile = path.join(dataDir, "data.json");

const supportedExtensions = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".csv",
  ".txt",
  ".md",
  ".json",
  ".html",
  ".htm",
  ".eml",
  ".msg",
  ".png",
  ".jpg",
  ".jpeg",
  ".tif",
  ".tiff"
]);

const textExtensions = new Set([".csv", ".txt", ".md", ".json", ".html", ".htm", ".eml"]);

export async function readData(): Promise<AppData> {
  try {
    const raw = await readFile(dataFile, "utf8");
    return JSON.parse(raw) as AppData;
  } catch {
    return { connectors: [], documents: [], auditTrail: [] };
  }
}

export async function writeData(data: AppData) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(dataFile, JSON.stringify(data, null, 2), "utf8");
}

export async function addConnector(input: { name: string; path: string }) {
  const data = await readData();
  const connector: FolderConnector = {
    id: createId("SRC"),
    name: input.name.trim() || path.basename(input.path),
    path: input.path.trim(),
    status: "Bereit",
    documentsFound: 0
  };
  data.connectors.unshift(connector);
  data.auditTrail.unshift(`${new Date().toISOString()} · Ordnerquelle angelegt · ${connector.path}`);
  await writeData(data);
  return connector;
}

export async function scanConnector(connectorId: string) {
  const data = await readData();
  const connector = data.connectors.find((item) => item.id === connectorId);
  if (!connector) {
    throw new Error("Ordnerquelle nicht gefunden.");
  }

  try {
    const files = await listFiles(connector.path, 80);
    const scannedDocuments: StoredDocument[] = [];

    for (const file of files) {
      const fileStat = await stat(file);
      const extension = path.extname(file).toLowerCase();
      const existing = data.documents.find((document) => document.filePath === file);
      const extractedText = await extractPreviewText(file, extension);
      const document = analyzeFile({
        id: existing?.id ?? createId("DOC"),
        file,
        size: fileStat.size,
        modifiedAt: fileStat.mtime.toISOString(),
        extractedText,
        sourceConnectorId: connector.id
      });
      scannedDocuments.push(document);
    }

    const untouchedDocuments = data.documents.filter((document) => document.sourceConnectorId !== connector.id);
    data.documents = [...scannedDocuments, ...untouchedDocuments];
    connector.status = "Aktiv";
    connector.lastScan = new Date().toISOString();
    connector.documentsFound = scannedDocuments.length;
    delete connector.error;
    data.auditTrail.unshift(`${new Date().toISOString()} · Ordner gescannt · ${connector.path} · ${scannedDocuments.length} Dokumente`);
    await writeData(data);
    return { connector, documents: scannedDocuments };
  } catch (error) {
    connector.status = "Fehler";
    connector.error = error instanceof Error ? error.message : "Unbekannter Scanfehler";
    data.auditTrail.unshift(`${new Date().toISOString()} · Scanfehler · ${connector.path} · ${connector.error}`);
    await writeData(data);
    return { connector, documents: [] as StoredDocument[] };
  }
}

export async function scanAllConnectors() {
  const data = await readData();
  const connectorIds = data.connectors.map((connector) => connector.id);
  const results = [];
  for (const connectorId of connectorIds) {
    results.push(await scanConnector(connectorId));
  }
  return results;
}

export async function answerQuestion(question: string) {
  const data = await readData();
  const normalized = question.toLowerCase();
  const terms = normalized
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((word) => word.length > 3);
  const matches = data.documents
    .map((document) => {
      const haystack = `${document.title} ${document.type} ${document.summary} ${document.risks.join(" ")} ${document.tasks.join(" ")} ${document.deadlines.join(" ")} ${document.extractedText}`.toLowerCase();
      const score = terms.reduce((sum, word) => sum + (haystack.includes(word) ? 1 : 0), 0) + (document.risk === "Rot" ? 0.5 : 0);
      return { document, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.document)
    .slice(0, 5);

  const documents = matches.length > 0 ? matches : data.documents.slice(0, 5);
  const critical = documents.filter((document) => document.risk === "Rot");
  const deadlines = documents.flatMap((document) => document.deadlines.map((deadline) => `${deadline} (${document.id})`));

  return {
    answer:
      critical.length > 0
        ? `Ich habe ${critical.length} kritische Treffer gefunden. Wichtig sind ${critical.map((document) => document.title).join(", ")}. Nächster Schritt: ${critical[0].nextStep}`
        : deadlines.length > 0
          ? `Ich habe vor allem Fristen gefunden: ${deadlines.slice(0, 3).join("; ")}.`
          : "Ich habe keine kritischen Treffer gefunden. Die beste Trefferliste basiert auf Titel, Dokumenttyp, Risiken, Aufgaben und extrahiertem Text.",
    sources: documents.map((document) => ({ id: document.id, title: document.title, path: document.filePath }))
  };
}

export async function createExportPayload(kind: "management" | "risks" | "tasks" | "deadlines" | "documents") {
  const data = await readData();
  const now = new Date().toISOString();
  const critical = data.documents.filter((document) => document.risk === "Rot");
  const tasks = data.documents.flatMap((document) => document.tasks.map((task) => ({ documentId: document.id, document: document.title, task, owner: document.owner, priority: document.priority })));
  const deadlines = data.documents.flatMap((document) => document.deadlines.map((deadline) => ({ documentId: document.id, document: document.title, deadline })));

  const payload = {
    generatedAt: now,
    kind,
    summary: {
      documents: data.documents.length,
      connectors: data.connectors.length,
      criticalDocuments: critical.length,
      tasks: tasks.length,
      deadlines: deadlines.length
    },
    connectors: data.connectors,
    documents: data.documents.map((document) => ({
      id: document.id,
      title: document.title,
      type: document.type,
      project: document.project,
      risk: document.risk,
      priority: document.priority,
      status: document.status,
      summary: document.summary,
      nextStep: document.nextStep,
      source: document.filePath
    })),
    risks: data.documents.flatMap((document) => document.risks.map((risk) => ({ documentId: document.id, document: document.title, risk, level: document.risk }))),
    tasks,
    deadlines,
    auditTrail: data.auditTrail.slice(0, 50)
  };

  return payload;
}

async function listFiles(folderPath: string, limit: number) {
  const result: string[] = [];

  async function walk(currentPath: string) {
    if (result.length >= limit) return;
    const entries = await readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      if (result.length >= limit) return;
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (supportedExtensions.has(path.extname(entry.name).toLowerCase())) {
        result.push(fullPath);
      }
    }
  }

  await walk(folderPath);
  return result;
}

async function extractPreviewText(file: string, extension: string) {
  try {
    if (extension === ".pdf") return await extractPdf(file);
    if (extension === ".docx") return await extractDocx(file);
    if (extension === ".xlsx" || extension === ".xls") return await extractWorkbook(file);
    if (textExtensions.has(extension)) {
      const raw = await readFile(file, "utf8");
      return normalizeExtractedText(stripMarkup(raw)).slice(0, 12000);
    }
    if ([".png", ".jpg", ".jpeg", ".tif", ".tiff"].includes(extension)) {
      return `Bild/Scan ${path.basename(file)} wurde erkannt. OCR ist vorbereitet, benoetigt aber einen Tesseract- oder Cloud-OCR-Adapter.`;
    }
    return `Datei ${path.basename(file)} wurde erkannt. Fuer ${extension || "unbekannt"} ist noch kein Volltextadapter aktiviert.`;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unbekannter Fehler";
    return `Datei ${path.basename(file)} wurde erkannt, konnte aber nicht extrahiert werden: ${reason}`;
  }
}

async function extractPdf(file: string) {
  const buffer = await readFile(file);
  const text = buffer
    .toString("latin1")
    .replace(/[^\x20-\x7EÄÖÜäöüß€\n\r\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const usefulText = text
    .split(" ")
    .filter((token) => /[A-Za-zÄÖÜäöüß]{3,}/.test(token))
    .join(" ");
  return usefulText
    ? normalizeExtractedText(usefulText).slice(0, 12000)
    : `PDF ${path.basename(file)} wurde erkannt. Für gescannte oder komprimierte PDFs ist ein OCR/PDF-Textadapter erforderlich.`;
}

async function extractDocx(file: string) {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ path: file });
  return normalizeExtractedText(result.value).slice(0, 12000);
}

async function extractWorkbook(file: string) {
  return `Excel-Datei ${path.basename(file)} wurde erkannt. CSV-Dateien werden bereits direkt ausgelesen; fuer native XLS/XLSX-Dateien ist als naechster stabiler Adapter LibreOffice- oder Cloud-Konvertierung vorgesehen.`;
}

function stripMarkup(text: string) {
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

function normalizeExtractedText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function analyzeFile(input: { id: string; file: string; size: number; modifiedAt: string; extractedText: string; sourceConnectorId: string }): StoredDocument {
  const fileName = path.basename(input.file);
  const extension = path.extname(fileName).toLowerCase();
  const title = fileName.replace(extension, "").replace(/[_-]+/g, " ");
  const text = `${title} ${input.extractedText}`.toLowerCase();
  const type = classifyDocument(text, extension);
  const risk = classifyRisk(text, type);
  const deadlines = extractDeadlines(input.extractedText);
  const tasks = extractTasks(text, type);

  return {
    id: input.id,
    title,
    fileName,
    filePath: input.file,
    extension: extension || "unbekannt",
    size: input.size,
    modifiedAt: input.modifiedAt,
    type,
    project: inferProject(title),
    owner: "KI-Import",
    date: new Intl.DateTimeFormat("de-DE").format(new Date(input.modifiedAt)),
    risk,
    priority: risk === "Rot" ? "Hoch" : risk === "Gelb" ? "Mittel" : "Normal",
    status: risk === "Rot" ? "In Pruefung" : "Analysiert",
    summary: createSummary(title, type, risk, input.extractedText),
    risks: createRisks(text, type, risk),
    tasks,
    deadlines,
    nextStep: createNextStep(type, risk),
    extractedText: input.extractedText,
    sourceConnectorId: input.sourceConnectorId
  };
}

function classifyDocument(text: string, extension: string) {
  if (text.includes("rechnung") || text.includes("invoice")) return "Rechnung";
  if (text.includes("lieferschein") || text.includes("delivery")) return "Lieferschein";
  if (text.includes("vertrag") || text.includes("contract")) return "Vertrag";
  if (text.includes("nachtrag")) return "Nachtrag";
  if (text.includes("protokoll") || text.includes("meeting")) return "Baubesprechungsprotokoll";
  if (text.includes("angebot") || text.includes("ausschreibung")) return "Angebot";
  if (extension === ".eml" || extension === ".msg") return "E-Mail";
  if ([".png", ".jpg", ".jpeg", ".tif", ".tiff"].includes(extension)) return "Scan/Bild";
  return "Dokument";
}

function classifyRisk(text: string, type: string): RiskLevel {
  const redWords = ["verzug", "mahnung", "kritisch", "vertragsstrafe", "kuendigung", "kündigung", "mangel", "eskalation", "mehrkosten"];
  const yellowWords = ["frist", "offen", "abweichung", "pruefen", "prüfen", "freigabe", "zahlung", "haftung"];
  if (redWords.some((word) => text.includes(word))) return "Rot";
  if (yellowWords.some((word) => text.includes(word)) || ["Rechnung", "Nachtrag", "Vertrag"].includes(type)) return "Gelb";
  return "Gruen";
}

function extractDeadlines(text: string) {
  const matches = text.match(/\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/g) ?? [];
  return [...new Set(matches)]
    .filter((date) => {
      const parts = date.split(/[./-]/).map((part) => Number(part));
      const year = parts[2] < 100 ? 2000 + parts[2] : parts[2];
      return parts[0] >= 1 && parts[0] <= 31 && parts[1] >= 1 && parts[1] <= 12 && year >= 2020 && year <= 2100;
    })
    .slice(0, 5)
    .map((date) => `Frist/Wiedervorlage ${date}`);
}

function extractTasks(text: string, type: string) {
  const tasks = [];
  if (text.includes("freigabe") || type === "Nachtrag") tasks.push("Freigabe und Anspruchsgrundlage prüfen");
  if (text.includes("rechnung") || type === "Rechnung") tasks.push("Rechnung gegen Vertrag und Lieferschein prüfen");
  if (text.includes("frist")) tasks.push("Frist in Wiedervorlage übernehmen");
  if (text.includes("mangel")) tasks.push("Mangelstatus und Verantwortlichkeit klären");
  if (tasks.length === 0) tasks.push("Dokument fachlich sichten und Projekt zuordnen");
  return tasks;
}

function createSummary(title: string, type: string, risk: RiskLevel, text: string) {
  const preview = text && !text.startsWith("Datei ") ? ` Inhaltshinweis: ${text.slice(0, 180)}${text.length > 180 ? "..." : ""}` : "";
  return `${title} wurde als ${type} klassifiziert. Ampelbewertung: ${risk === "Gruen" ? "Grün" : risk}.${preview}`;
}

function createRisks(text: string, type: string, risk: RiskLevel) {
  if (risk === "Rot") return ["Kritische Formulierungen oder Projektstörungen erkannt", "Management-Prüfung empfohlen"];
  if (risk === "Gelb") return [`${type} enthält prüfbedürftige Punkte`, "Fristen, Zahlungen oder Verantwortlichkeiten validieren"];
  return ["Keine akuten Risiken aus Dateiname oder Textvorschau erkannt"];
}

function createNextStep(type: string, risk: RiskLevel) {
  if (risk === "Rot") return `${type} priorisiert prüfen, Verantwortliche zuweisen und Management Summary erzeugen.`;
  if (risk === "Gelb") return `${type} fachlich validieren und offene Punkte dokumentieren.`;
  return "Dokument archivieren oder dem passenden Projekt zuordnen.";
}

function inferProject(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes("linden") || lower.includes("elektro")) return "Wohnquartier Lindenweg";
  if (lower.includes("halle") || lower.includes("stahl")) return "Logistikhalle Nord";
  if (lower.includes("marien") || lower.includes("büro") || lower.includes("buero")) return "Büroausbau Marienplatz";
  return "Nicht zugeordnet";
}

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}
