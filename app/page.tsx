"use client";

import {
  AlertTriangle,
  Archive,
  Bell,
  Bot,
  BookOpen,
  Briefcase,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  Cloud,
  Database,
  Download,
  Eye,
  FileArchive,
  FileClock,
  FileSearch,
  FileText,
  Filter,
  FolderKanban,
  GitBranch,
  History,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  LockKeyhole,
  Mail,
  MessageSquareText,
  MoreHorizontal,
  Palette,
  Plus,
  Radar,
  Scale,
  Search,
  ServerCog,
  Settings,
  ShieldCheck,
  Sparkles,
  Tags,
  UploadCloud,
  Workflow,
  UsersRound,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type RiskLevel = "Gruen" | "Gelb" | "Rot";
type DocumentStatus = "Analysiert" | "In Pruefung" | "Offen" | "Archiviert";

type DocumentRecord = {
  id: string;
  title: string;
  type: string;
  project: string;
  owner: string;
  date: string;
  risk: RiskLevel;
  priority: "Hoch" | "Mittel" | "Normal";
  status: DocumentStatus;
  summary: string;
  risks: string[];
  tasks: string[];
  deadlines: string[];
  nextStep: string;
};

type ProjectRecord = {
  name: string;
  client: string;
  status: string;
  start: string;
  end: string;
  risk: RiskLevel;
  summary: string;
};

type FolderConnector = {
  id: string;
  name: string;
  path: string;
  status: "Aktiv" | "Bereit" | "Fehler" | "Geplant";
  lastScan?: string;
  documentsFound: number;
  error?: string;
};

type ApiState = {
  connectors: FolderConnector[];
  documents: Array<DocumentRecord & {
    filePath?: string;
    fileName?: string;
    modifiedAt?: string;
    sourceConnectorId?: string;
  }>;
  auditTrail: string[];
};

const tenants = [
  "BuiltSmart Hub",
  "BuiltSmart AI",
  "Metzger - Real Estate Advisory",
  "Kundenmandant 1",
  "Kundenmandant 2"
];

const projects: ProjectRecord[] = [
  {
    name: "Wohnquartier Lindenweg",
    client: "Arealbau Süd GmbH",
    status: "Ausführung",
    start: "15.01.2026",
    end: "30.11.2026",
    risk: "Rot",
    summary: "Nachtrag und Lieferverzug beeinflussen Kosten und Terminplan."
  },
  {
    name: "Logistikhalle Nord",
    client: "Hansa Gewerbe AG",
    status: "Vergabe",
    start: "01.03.2026",
    end: "20.12.2026",
    risk: "Gelb",
    summary: "Angebotsprüfung offen, Preisbindung endet in 18 Tagen."
  },
  {
    name: "Büroausbau Marienplatz",
    client: "CoreSpace GmbH",
    status: "Abnahme",
    start: "10.02.2026",
    end: "12.07.2026",
    risk: "Gelb",
    summary: "Mängelliste priorisieren, sonst verzögert sich die Schlussrechnung."
  }
];

const documents: DocumentRecord[] = [
  {
    id: "DOC-1042",
    title: "Nachtrag Elektro Gewerke 3",
    type: "Nachtrag",
    project: "Wohnquartier Lindenweg",
    owner: "Bauleitung",
    date: "18.06.2026",
    risk: "Rot",
    priority: "Hoch",
    status: "In Pruefung",
    summary: "Mehrkosten von 48.600 EUR werden mit geänderten Leitungswegen begründet.",
    risks: ["Vergütungsanspruch nicht ausreichend belegt", "Terminfolge unklar", "Freigabe vor Ausführung fehlt"],
    tasks: ["Mengenansatz prüfen", "Planänderung mit Auftraggeber bestätigen", "Nachtragsfrist dokumentieren"],
    deadlines: ["Stellungnahme bis 25.06.2026", "Freigabeentscheidung bis 28.06.2026"],
    nextStep: "Technische Begründung und vertragliche Grundlage zusammenführen."
  },
  {
    id: "DOC-1038",
    title: "Baubesprechungsprotokoll KW24",
    type: "Baubesprechungsprotokoll",
    project: "Wohnquartier Lindenweg",
    owner: "Projektleitung",
    date: "14.06.2026",
    risk: "Gelb",
    priority: "Mittel",
    status: "Analysiert",
    summary: "Drei offene Punkte betreffen Brandschutz, Fassadenlieferung und Baustrom.",
    risks: ["Unklare Verantwortlichkeit Fassadenlieferung", "Brandschutzfreigabe verzögert"],
    tasks: ["Brandschutzplaner nachfassen", "Liefertermin schriftlich bestätigen"],
    deadlines: ["Brandschutzfreigabe bis 27.06.2026"],
    nextStep: "Offene Punkte im nächsten Jour fixe priorisieren."
  },
  {
    id: "DOC-1019",
    title: "Rechnung Materiallieferung Juni",
    type: "Rechnung",
    project: "Büroausbau Marienplatz",
    owner: "Controlling",
    date: "11.06.2026",
    risk: "Gelb",
    priority: "Mittel",
    status: "Offen",
    summary: "Rechnungsbetrag liegt 7,8 Prozent über bestätigtem Lieferschein.",
    risks: ["Mengenabweichung bei Trockenbauprofilen", "Skonto-Frist läuft ab"],
    tasks: ["Lieferscheinpositionen abgleichen", "Teilfreigabe vorbereiten"],
    deadlines: ["Skonto bis 24.06.2026"],
    nextStep: "Mengenabweichung vor Zahlungsfreigabe klären."
  },
  {
    id: "DOC-1007",
    title: "Angebot Stahlbau Los 2",
    type: "Angebot",
    project: "Logistikhalle Nord",
    owner: "Einkauf",
    date: "07.06.2026",
    risk: "Gelb",
    priority: "Hoch",
    status: "Analysiert",
    summary: "Preisbindung und Montagefenster sind kritisch für Vergabeentscheidung.",
    risks: ["Preisbindung endet bald", "Montagefenster überschneidet Ausbaugewerke"],
    tasks: ["Bieterklärung anfordern", "Montagefolge mit Terminplan abstimmen"],
    deadlines: ["Preisbindung bis 09.07.2026"],
    nextStep: "Vergabevorlage mit technischen Nebenbedingungen ergänzen."
  },
  {
    id: "DOC-0994",
    title: "Wartungsvertrag Gebäudeautomation",
    type: "Vertrag",
    project: "Büroausbau Marienplatz",
    owner: "Geschäftsführung",
    date: "02.06.2026",
    risk: "Gruen",
    priority: "Normal",
    status: "Archiviert",
    summary: "Kündigungsfrist, Servicelevel und Haftungsgrenze sind klar geregelt.",
    risks: ["Keine akuten Risiken erkannt"],
    tasks: ["Vertrag im Projektarchiv ablegen"],
    deadlines: ["Kündigungsoption zum 31.12.2026"],
    nextStep: "Wiedervorlage 90 Tage vor Kündigungsfrist einrichten."
  }
];

const modes = [
  "Zusammenfassung",
  "Management Summary",
  "Risikoanalyse",
  "Aufgaben und Fristen",
  "Rechnungs- und Lieferscheinprüfung",
  "Vertragsprüfung",
  "Projektstatus"
];

const relationshipMap = [
  { source: "Vertrag", detail: "Fertigstellung 30.11.2026", target: "Protokoll KW24", insight: "Verzug Brandschutz gefährdet Terminpuffer" },
  { source: "Lieferschein", detail: "Lieferung 5 Tage verspätet", target: "Nachtrag Elektro", insight: "Mehrkosten und Bauablaufstörung zusammenführen" },
  { source: "Rechnung", detail: "+7,8 % Mengenabweichung", target: "Lieferschein 1458", insight: "Zahlungsfreigabe nur nach Positionsabgleich" }
];

const monitoringSources = [
  { name: "Lokale Projektordner", status: "Aktiv", files: 42 },
  { name: "SharePoint Bauleitung", status: "Aktiv", files: 18 },
  { name: "OneDrive Geschäftsführung", status: "Bereit", files: 9 },
  { name: "SFTP Lieferantenportal", status: "Geplant", files: 0 }
];

const knowledgeQueries = [
  "Nachträge über 50.000 Euro",
  "Risiken zum Thema Terminverzug",
  "Lieferanten mit häufigen Abweichungen",
  "Maßnahmen aus vergleichbaren Projekten"
];

const enterpriseRisks = [
  { category: "Terminrisiko", probability: "72 %", impact: "Hoch", value: 86, status: "Rot" as RiskLevel },
  { category: "Kostenrisiko", probability: "58 %", impact: "Mittel", value: 64, status: "Gelb" as RiskLevel },
  { category: "Compliance-Risiko", probability: "24 %", impact: "Mittel", value: 31, status: "Gruen" as RiskLevel }
];

const agents = [
  "Contract Agent",
  "Risk Agent",
  "Invoice Agent",
  "Delivery Agent",
  "Project Agent",
  "Reporting Agent",
  "Knowledge Agent"
];

const reports = ["Wochenbericht", "Monatsbericht", "Projektstatusbericht", "Risikobericht", "Managementbericht", "Vorstandsbericht"];

const roles = ["Administrator", "Geschäftsführung", "Projektleiter", "Controller", "Bauleiter", "Sachbearbeiter", "Gast"];

const navItems = [
  { label: "Startdashboard", icon: LayoutDashboard },
  { label: "Dokumentenimport", icon: UploadCloud },
  { label: "Analysezentrum", icon: Sparkles },
  { label: "Dokumentenübersicht", icon: FileText },
  { label: "Risikodashboard", icon: AlertTriangle },
  { label: "Aufgaben", icon: ListChecks },
  { label: "Fristen", icon: CalendarClock },
  { label: "Projekte", icon: FolderKanban },
  { label: "KI-Projektakte", icon: GitBranch },
  { label: "Wissen", icon: Database },
  { label: "Agenten", icon: Bot },
  { label: "Management", icon: Briefcase },
  { label: "Export", icon: Download },
  { label: "Einstellungen", icon: Settings },
  { label: "Mandanten", icon: Building2 }
];

function riskClass(risk: RiskLevel) {
  return {
    Gruen: "status status-green",
    Gelb: "status status-yellow",
    Rot: "status status-red"
  }[risk];
}

function riskText(risk: RiskLevel) {
  return risk === "Gruen" ? "Grün" : risk;
}

export default function Home() {
  const [tenant, setTenant] = useState(tenants[0]);
  const [activeNav, setActiveNav] = useState("Startdashboard");
  const [projectFilter, setProjectFilter] = useState("Alle Projekte");
  const [riskFilter, setRiskFilter] = useState("Alle Risiken");
  const [selectedMode, setSelectedMode] = useState(modes[2]);
  const [selectedDocId, setSelectedDocId] = useState(documents[0].id);
  const [chatInput, setChatInput] = useState("Welche Dokumente benötigen diese Woche Management-Aufmerksamkeit?");
  const [chatAnswer, setChatAnswer] = useState("Priorität haben Nachtrag Elektro, Rechnung Juni und Angebot Stahlbau. Quellen: DOC-1042, DOC-1019, DOC-1007.");
  const [chatSources, setChatSources] = useState([{ id: "DOC-1042", title: "Nachtrag Elektro" }, { id: "DOC-1019", title: "Rechnung Juni" }, { id: "DOC-1007", title: "Angebot Stahlbau" }]);
  const [uploadedFiles, setUploadedFiles] = useState(["Nachtrag_Elektro_Gewerk3.pdf", "Lieferschein_1458.xlsx"]);
  const [apiState, setApiState] = useState<ApiState>({ connectors: [], documents: [], auditTrail: [] });
  const [folderPath, setFolderPath] = useState("/Users/bernhardmetzger/Documents/Playground/SMART Document Intelligence");
  const [folderName, setFolderName] = useState("Lokaler Dokumentenordner");
  const [isScanning, setIsScanning] = useState(false);
  const [systemMessage, setSystemMessage] = useState("Noch keine lokale Ordnerquelle gescannt.");

  const allDocuments = useMemo(() => {
    const scannedIds = new Set(apiState.documents.map((document) => document.id));
    return [...apiState.documents, ...documents.filter((document) => !scannedIds.has(document.id))];
  }, [apiState.documents]);

  const filteredDocs = useMemo(() => {
    return allDocuments.filter((document) => {
      const projectMatch = projectFilter === "Alle Projekte" || document.project === projectFilter;
      const riskMatch = riskFilter === "Alle Risiken" || riskText(document.risk) === riskFilter;
      return projectMatch && riskMatch;
    });
  }, [allDocuments, projectFilter, riskFilter]);

  const selectedDoc = allDocuments.find((document) => document.id === selectedDocId) ?? allDocuments[0] ?? documents[0];
  const criticalDocs = allDocuments.filter((document) => document.risk === "Rot").length;
  const openTasks = allDocuments.reduce((sum, document) => sum + document.tasks.length, 0);
  const deadlines = allDocuments.reduce((sum, document) => sum + document.deadlines.length, 0);
  const redRisks = allDocuments.reduce((sum, document) => sum + document.risks.filter(() => document.risk === "Rot").length, 0);

  useEffect(() => {
    refreshState();
  }, []);

  function handleFiles(files: FileList | null) {
    if (!files) return;
    const nextFiles = Array.from(files).map((file) => file.name);
    setUploadedFiles((current) => [...nextFiles, ...current].slice(0, 5));
  }

  async function refreshState() {
    const response = await fetch("/api/state");
    if (!response.ok) return;
    const nextState = (await response.json()) as ApiState;
    setApiState(nextState);
    if (nextState.documents.length > 0) {
      setSystemMessage(`${nextState.documents.length} lokale Dokumente im Analysebestand.`);
    }
  }

  async function createConnector() {
    setSystemMessage("Ordnerquelle wird angelegt...");
    const response = await fetch("/api/connectors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: folderName, path: folderPath })
    });
    const result = await response.json();
    if (!response.ok) {
      setSystemMessage(result.error ?? "Ordnerquelle konnte nicht angelegt werden.");
      return;
    }
    setApiState((current) => ({ ...current, connectors: [result.connector, ...current.connectors] }));
    setSystemMessage("Ordnerquelle angelegt. Scan kann gestartet werden.");
  }

  async function scanConnector(connectorId: string) {
    setIsScanning(true);
    setSystemMessage("Ordner wird gescannt und Dokumente werden klassifiziert...");
    const response = await fetch(`/api/connectors/${connectorId}/scan`, { method: "POST" });
    const result = await response.json();
    await refreshState();
    setIsScanning(false);
    if (result.connector?.status === "Fehler") {
      setSystemMessage(`Scanfehler: ${result.connector.error}`);
      return;
    }
    setSystemMessage(`${result.documents?.length ?? 0} Dokumente erkannt, klassifiziert und gespeichert.`);
  }

  async function scanAllSources() {
    setIsScanning(true);
    setSystemMessage("Alle Ordnerquellen werden neu gescannt...");
    let scannedSources = 0;
    for (const connector of apiState.connectors) {
      await fetch(`/api/connectors/${connector.id}/scan`, { method: "POST" });
      scannedSources += 1;
    }
    await refreshState();
    setIsScanning(false);
    setSystemMessage(`${scannedSources} Quellen neu geprüft.`);
  }

  function downloadExport(kind: "management" | "risks" | "tasks" | "deadlines" | "documents", format: "json" | "csv" = "json") {
    window.location.href = `/api/export/${kind}?format=${format}`;
  }

  async function askKnowledgeBase() {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: chatInput })
    });
    const result = await response.json();
    if (!response.ok) {
      setChatAnswer(result.error ?? "Die Frage konnte nicht beantwortet werden.");
      return;
    }
    setChatAnswer(result.answer);
    setChatSources(result.sources ?? []);
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <FileSearch size={22} />
          </div>
          <div>
            <strong>SMART</strong>
            <span>Document Intelligence</span>
          </div>
        </div>

        <label className="tenant-select">
          <span>Mandant</span>
          <select value={tenant} onChange={(event) => setTenant(event.target.value)} aria-label="Mandant wählen">
            {tenants.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <ChevronDown size={16} />
        </label>

        <nav className="nav-list" aria-label="Hauptnavigation">
          {navItems.map(({ label, icon: Icon }) => (
            <button className={activeNav === label ? "nav-active" : ""} key={label} onClick={() => setActiveNav(label)}>
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="security-box">
          <ShieldCheck size={19} />
          <div>
            <strong>Datenschutzmodus aktiv</strong>
            <span>Mandantentrennung, BYOK und Löschkonzept vorbereitet.</span>
          </div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">{tenant} · KI-Auswertung für KMU-Dokumente</p>
            <h1>{activeNav}</h1>
          </div>
          <div className="topbar-actions">
            <div className="search">
              <Search size={18} />
              <input placeholder="Volltextsuche über Dokumente, Risiken, Fristen" />
            </div>
            <button className="icon-button" title="Neue Analyse">
              <Plus size={19} />
            </button>
            <button className="primary-button">
              <UploadCloud size={18} />
              Import starten
            </button>
          </div>
        </header>

        <section className="metric-grid" aria-label="Kennzahlen">
          <Metric title="Analysierte Dokumente" value={allDocuments.length.toString()} delta={`${apiState.documents.length} aus Ordnern`} icon={<FileArchive size={20} />} />
          <Metric title="Kritische Dokumente" value={criticalDocs.toString()} delta="1 neu seit gestern" icon={<AlertTriangle size={20} />} danger />
          <Metric title="Offene Aufgaben" value={openTasks.toString()} delta="6 mit Verantwortlichen" icon={<ClipboardCheck size={20} />} />
          <Metric title="Erkannte Fristen" value={deadlines.toString()} delta="3 innerhalb 14 Tage" icon={<CalendarClock size={20} />} />
          <Metric title="Rote Risiken" value={redRisks.toString()} delta="vertraglich prüfen" icon={<LockKeyhole size={20} />} danger />
        </section>

        <section className="content-grid">
          <div className="panel executive-panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Unternehmenscockpit</p>
                <h2>Management-Dashboard für Portfolio, Warnungen und Entscheidungen</h2>
              </div>
              <Briefcase size={22} />
            </div>
            <div className="cockpit-grid">
              <CompactKpi label="Projektportfolio" value="3 aktiv" detail="1 kritisch" />
              <CompactKpi label="Vertragsstatus" value="12 Verträge" detail="3 Fristen in 6 Monaten" />
              <CompactKpi label="Kostenwarnungen" value="2 offen" detail="Nachtrag und Rechnung" />
              <CompactKpi label="Lieferantenbewertung" value="B-" detail="2 Lieferverzüge erkannt" />
              <CompactKpi label="ESG-Status" value="Prüfbar" detail="4 fehlende Nachweise" />
              <CompactKpi label="Terminwarnungen" value="3" detail="Brandschutz, Fassade, Vergabe" />
            </div>
          </div>

          <div className="panel import-panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Dokumentenimport</p>
                <h2>Ordner, Dateien und Exporte analysieren</h2>
              </div>
              <span className="mini-pill">PDF · Word · Excel · E-Mail · OCR</span>
            </div>

            <label className="dropzone">
              <UploadCloud size={32} />
              <strong>Dateien oder Ordner hier ablegen</strong>
              <span>Lokale Verarbeitung vorbereiten, OCR erkennen und Text extrahieren.</span>
              <input type="file" multiple onChange={(event) => handleFiles(event.target.files)} />
            </label>

            <div className="upload-list">
              {uploadedFiles.map((file) => (
                <div key={file}>
                  <FileText size={17} />
                  <span>{file}</span>
                  <CheckCircle2 size={17} />
                </div>
              ))}
            </div>
          </div>

          <div className="panel analysis-panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Analysezentrum</p>
                <h2>KI-Modus und strukturierte Ausgabe</h2>
              </div>
              <Sparkles size={22} />
            </div>
            <div className="mode-grid">
              {modes.map((mode) => (
                <button className={selectedMode === mode ? "mode-active" : ""} key={mode} onClick={() => setSelectedMode(mode)}>
                  {mode}
              </button>
            ))}
            </div>
            <div className="analysis-output">
              <div>
                <span>Dokument</span>
                <strong>{selectedDoc.title}</strong>
              </div>
              <div>
                <span>Ausgabeformat</span>
                <strong>{selectedMode}</strong>
              </div>
              <div>
                <span>Ampelbewertung</span>
                <strong className={riskClass(selectedDoc.risk)}>{riskText(selectedDoc.risk)}</strong>
              </div>
              <p>{selectedDoc.summary}</p>
            </div>
          </div>

          <div className="panel project-file-panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">KI-Projektakte</p>
                <h2>Dokumente automatisch verknüpfen und Projektwissen ableiten</h2>
              </div>
              <GitBranch size={22} />
            </div>
            <div className="relationship-list">
              {relationshipMap.map((item) => (
                <div className="relationship-item" key={`${item.source}-${item.target}`}>
                  <strong>{item.source}</strong>
                  <span>{item.detail}</span>
                  <GitBranch size={17} />
                  <strong>{item.target}</strong>
                  <p>{item.insight}</p>
                </div>
              ))}
            </div>
            <div className="artifact-strip">
              {["Projektstatus", "Management Summary", "Risikobericht", "Entscheidungsvorlage", "Lessons Learned", "Projektchronologie"].map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </div>

          <div className="panel monitoring-panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Dokumentenüberwachung</p>
                <h2>Quellen verbinden und Hintergrundanalyse starten</h2>
              </div>
              <Cloud size={22} />
            </div>
            <div className="connector-form">
              <label>
                <span>Quellenname</span>
                <input value={folderName} onChange={(event) => setFolderName(event.target.value)} />
              </label>
              <label>
                <span>Lokaler Ordnerpfad</span>
                <input value={folderPath} onChange={(event) => setFolderPath(event.target.value)} placeholder="/Users/.../Projektordner" />
              </label>
              <button onClick={createConnector} type="button">
                <Plus size={17} />
                Ordnerquelle anlegen
              </button>
              <button disabled={isScanning || apiState.connectors.length === 0} onClick={scanAllSources} type="button">
                <Workflow size={17} />
                Alle Quellen scannen
              </button>
              <small>{systemMessage}</small>
            </div>
            <div className="source-list">
              {[...apiState.connectors, ...monitoringSources.map((source) => ({ id: source.name, name: source.name, path: "Demo-Quelle", status: source.status as FolderConnector["status"], documentsFound: source.files }))].map((source) => (
                <div className="source-item" key={source.id}>
                  <ServerCog size={18} />
                  <div>
                    <strong>{source.name}</strong>
                    <span>{source.documentsFound} erkannte Dateien · {source.path}</span>
                  </div>
                  <span className={source.status === "Aktiv" ? "status status-green" : source.status === "Bereit" ? "status status-yellow" : "status"}>{source.status}</span>
                  {source.path !== "Demo-Quelle" ? (
                    <button className="scan-button" disabled={isScanning} onClick={() => scanConnector(source.id)} type="button">
                      <Workflow size={15} />
                      Scannen
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div className="panel documents-panel">
            <div className="panel-head row-head">
              <div>
                <p className="eyebrow">Dokumentenübersicht</p>
                <h2>Analysen mit Risiko, Status und Projekt</h2>
              </div>
              <div className="filters">
                <Filter size={17} />
                <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
                  <option>Alle Projekte</option>
                  {projects.map((project) => (
                    <option key={project.name}>{project.name}</option>
                  ))}
                </select>
                <select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)}>
                  <option>Alle Risiken</option>
                  <option>Rot</option>
                  <option>Gelb</option>
                  <option>Grün</option>
                </select>
              </div>
            </div>

            <div className="table">
              <div className="table-row table-headline">
                <span>Dokument</span>
                <span>Typ</span>
                <span>Projekt</span>
                <span>Risiko</span>
                <span>Status</span>
                <span></span>
              </div>
              {filteredDocs.map((document) => (
                <button className={selectedDoc.id === document.id ? "table-row selected" : "table-row"} key={document.id} onClick={() => setSelectedDocId(document.id)}>
                  <span>
                    <strong>{document.title}</strong>
                    <small>{document.id} · {document.date}</small>
                  </span>
                  <span>{document.type}</span>
                  <span>{document.project}</span>
                  <span className={riskClass(document.risk)}>{riskText(document.risk)}</span>
                  <span>{document.status}</span>
                  <MoreHorizontal size={18} />
                </button>
              ))}
            </div>
          </div>

          <div className="panel knowledge-panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Unternehmensweites Wissensmanagement</p>
                <h2>Semantische Suche, Schlagworte und Lessons Learned</h2>
              </div>
              <Database size={22} />
            </div>
            <div className="knowledge-search">
              <Search size={18} />
              <span>Welche Lieferanten verursachen die meisten Probleme?</span>
            </div>
            <div className="tag-cloud">
              {["Nachtrag", "Terminverzug", "Gewährleistung", "Brandschutz", "Lieferabweichung", "Kostenwarnung", "Best Practice", "ESG"].map((tag) => (
                <span key={tag}><Tags size={14} /> {tag}</span>
              ))}
            </div>
            <div className="query-list">
              {knowledgeQueries.map((query) => (
                <button key={query}>{query}</button>
              ))}
            </div>
          </div>

          <div className="panel risk-panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Risikodashboard</p>
                <h2>Begründete Ampellogik</h2>
              </div>
              <AlertTriangle size={22} />
            </div>
            <div className="risk-stack">
              {selectedDoc.risks.map((risk) => (
                <div key={risk} className="risk-item">
                  <span className={riskClass(selectedDoc.risk)}>{riskText(selectedDoc.risk)}</span>
                  <p>{risk}</p>
                </div>
              ))}
            </div>
            <div className="recommendation">
              <strong>Empfohlener nächster Schritt</strong>
              <p>{selectedDoc.nextStep}</p>
            </div>
          </div>

          <div className="panel early-warning-panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Risiko-Frühwarnsystem</p>
                <h2>Eintrittswahrscheinlichkeit, Schadenshöhe und Maßnahmen</h2>
              </div>
              <Radar size={22} />
            </div>
            <div className="risk-score-list">
              {enterpriseRisks.map((risk) => (
                <div className="risk-score" key={risk.category}>
                  <div>
                    <strong>{risk.category}</strong>
                    <span>{risk.probability} Wahrscheinlichkeit · Auswirkung {risk.impact}</span>
                  </div>
                  <b className={riskClass(risk.status)}>{risk.value}</b>
                </div>
              ))}
            </div>
          </div>

          <div className="panel tasks-panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Aufgaben und offene Punkte</p>
                <h2>Verantwortlichkeiten extrahieren</h2>
              </div>
              <ListChecks size={22} />
            </div>
            {selectedDoc.tasks.map((task, index) => (
              <label className="task-item" key={task}>
                <input type="checkbox" defaultChecked={index === 0} />
                <span>{task}</span>
                <small>{selectedDoc.owner}</small>
              </label>
            ))}
          </div>

          <div className="panel invoice-panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Rechnungs- und Lieferscheinanalyse</p>
                <h2>Mengen, Preise, Lieferverzug und Dubletten prüfen</h2>
              </div>
              <CircleDollarSign size={22} />
            </div>
            <div className="checklist-grid">
              {["Mengenabweichung +7,8 %", "Skonto-Frist läuft", "Lieferung 5 Tage verspätet", "Keine Dublette erkannt"].map((item, index) => (
                <div key={item}>
                  {index === 3 ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="panel contract-panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Vertragsanalyse Professional</p>
                <h2>Klauseln, Sicherheiten, Fristen und Verhandlungsempfehlungen</h2>
              </div>
              <Scale size={22} />
            </div>
            <div className="clause-grid">
              {["Haftung", "Gewährleistung", "Vertragsstrafen", "Kündigungsrechte", "Bürgschaften", "Zahlungsbedingungen"].map((clause) => (
                <span key={clause}>{clause}</span>
              ))}
            </div>
          </div>

          <div className="panel deadlines-panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Fristenübersicht</p>
                <h2>Termine und Wiedervorlagen</h2>
              </div>
              <Clock3 size={22} />
            </div>
            {selectedDoc.deadlines.map((deadline) => (
              <div className="deadline-item" key={deadline}>
                <CalendarClock size={18} />
                <span>{deadline}</span>
              </div>
            ))}
          </div>

          <div className="panel email-panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">E-Mail-Analyse</p>
                <h2>Outlook-Exporte, Konflikte, Entscheidungen und Eskalationen</h2>
              </div>
              <Mail size={22} />
            </div>
            <div className="timeline">
              <div><span>09.06.</span><p>Entscheidung zur Fassadenfreigabe vertagt.</p></div>
              <div><span>12.06.</span><p>Eskalation Liefertermin an Einkauf und Projektleitung.</p></div>
              <div><span>17.06.</span><p>Offener Punkt: Brandschutzfreigabe schriftlich bestätigen.</p></div>
            </div>
          </div>

          <div className="panel projects-panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Projektübersicht</p>
                <h2>Projektstatus mit Management Summary</h2>
              </div>
              <FolderKanban size={22} />
            </div>
            <div className="project-grid">
              {projects.map((project) => (
                <article key={project.name} className="project-card">
                  <div>
                    <strong>{project.name}</strong>
                    <span>{project.client}</span>
                  </div>
                  <span className={riskClass(project.risk)}>{riskText(project.risk)}</span>
                  <p>{project.summary}</p>
                  <small>{project.status} · {project.start} bis {project.end}</small>
                </article>
              ))}
            </div>
          </div>

          <div className="panel chat-panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Dokumentenchat</p>
                <h2>Fragen an den analysierten Bestand</h2>
              </div>
              <MessageSquareText size={22} />
            </div>
            <div className="chat-answer">
              <Sparkles size={18} />
              <p>{chatAnswer}</p>
            </div>
            <div className="source-citations">
              {chatSources.map((source) => (
                <span key={source.id}><BookOpen size={14} /> {source.id} {source.title}</span>
              ))}
            </div>
            <div className="chat-input">
              <input value={chatInput} onChange={(event) => setChatInput(event.target.value)} />
              <button title="Frage senden" onClick={askKnowledgeBase} type="button">
                <MessageSquareText size={18} />
              </button>
            </div>
          </div>

          <div className="panel agents-panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">KI-Agenten-System</p>
                <h2>Spezialisierte Agenten mit Prompts und Auswertungslogiken</h2>
              </div>
              <Bot size={22} />
            </div>
            <div className="agent-grid">
              {agents.map((agent, index) => (
                <button className={index < 3 ? "agent-active" : ""} key={agent}>
                  <Bot size={17} />
                  {agent}
                </button>
              ))}
            </div>
          </div>

          <div className="panel reports-panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">KI-Managementberichte</p>
                <h2>Automatische Berichte mit PDF-Export</h2>
              </div>
              <FileClock size={22} />
            </div>
            <div className="report-list">
              {reports.map((report) => (
                <button key={report}><Download size={17} /> {report}</button>
              ))}
            </div>
          </div>

          <div className="panel governance-panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Rollen, Rechte und Audit Trail</p>
                <h2>Granulare Rechteverwaltung und revisionssichere Protokolle</h2>
              </div>
              <Eye size={22} />
            </div>
            <div className="role-strip">
              {roles.map((role) => (
                <span key={role}>{role}</span>
              ))}
            </div>
            <div className="audit-list">
              <div><History size={17} /> 21.06.2026 · Analyse DOC-1042 · Projektleiter</div>
              <div><History size={17} /> 21.06.2026 · Export Risikobericht · Geschäftsführung</div>
              <div><History size={17} /> 20.06.2026 · Frist geändert · Controller</div>
            </div>
          </div>

          <div className="panel notification-panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Benachrichtigungssystem</p>
                <h2>E-Mail, In-App, Teams, Slack und Push</h2>
              </div>
              <Bell size={22} />
            </div>
            <div className="notification-grid">
              {["Neue Risiken", "Neue Dokumente", "Fristablauf", "Aufgabenfälligkeit", "Kritische Vertragsinhalte"].map((event) => (
                <span key={event}><Bell size={14} /> {event}</span>
              ))}
            </div>
          </div>

          <div className="panel whitelabel-panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">White-Label-Fähigkeit</p>
                <h2>Logo, Farben, Domain, E-Mail- und PDF-Vorlagen</h2>
              </div>
              <Palette size={22} />
            </div>
            <div className="brand-preview">
              <span className="color-swatch"></span>
              <div>
                <strong>{tenant}</strong>
                <p>Primärfarbe #527DF6 · Mandantenname, Domain und Berichtsvorlagen konfigurierbar.</p>
              </div>
            </div>
          </div>

          <div className="panel export-panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Export und Sicherheit</p>
                <h2>PDF, Word, Excel und BYOK</h2>
              </div>
              <Archive size={22} />
            </div>
            <div className="export-grid">
              <button onClick={() => downloadExport("management")} type="button"><Download size={18} /> Management JSON</button>
              <button onClick={() => downloadExport("risks", "csv")} type="button"><AlertTriangle size={18} /> Risikobericht CSV</button>
              <button onClick={() => downloadExport("tasks", "csv")} type="button"><CircleDollarSign size={18} /> Aufgabenliste CSV</button>
              <button onClick={() => downloadExport("deadlines", "csv")} type="button"><CalendarClock size={18} /> Fristenliste CSV</button>
              <button onClick={() => downloadExport("documents", "csv")} type="button"><FileText size={18} /> Dokumentliste CSV</button>
              <button><KeyRound size={18} /> Eigenen API-Key nutzen</button>
              <button><UsersRound size={18} /> Mandantenverwaltung</button>
              <button><X size={18} /> Daten löschen</button>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

function CompactKpi({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="compact-kpi">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function Metric({
  title,
  value,
  delta,
  icon,
  danger
}: {
  title: string;
  value: string;
  delta: string;
  icon: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <article className={danger ? "metric danger-metric" : "metric"}>
      <div>{icon}</div>
      <span>{title}</span>
      <strong>{value}</strong>
      <small>{delta}</small>
    </article>
  );
}
