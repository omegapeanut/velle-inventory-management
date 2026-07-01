import { useState, useEffect, useRef, useCallback } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { db, authReady } from "./services/firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { isCloudinaryConfigured, uploadImage } from "./services/cloudinary";
import { downloadDoc, printDoc, setCompanyInfo, downloadInvoice, printInvoice } from "./services/pdf";

// Mirrors one collection to a single Firestore document ("appState/<key>") and keeps
// it in sync across devices in real time. Setter matches useState (value or updater
// function), so existing screens work unchanged. Falls back to plain in-memory state
// when Firebase isn't configured.
function usePersistentState(key, seed) {
  const [state, setState] = useState(seed);
  const ready = useRef(false);
  useEffect(() => {
    if (!db) { ready.current = true; return; }
    let unsub = () => {};
    // Wait for anonymous auth so reads/writes pass the "must be signed in" rules.
    authReady.then(() => {
      const ref = doc(db, "appState", key);
      unsub = onSnapshot(ref, snap => {
        if (snap.exists()) setState(snap.data().items ?? seed);
        else setDoc(ref, { items: seed });
        ready.current = true;
      }, () => { ready.current = true; });
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const set = useCallback(updater => {
    setState(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (db && ready.current) setDoc(doc(db, "appState", key), { items: next }).catch(() => {});
      return next;
    });
  }, [key]);
  return [state, set];
}

// Photo upload: sends to Cloudinary when configured (stores a small URL), otherwise
// falls back to an inline base64 data URL so the app keeps working.
async function handlePhoto(e, setPhoto) {
  const f = e.target.files[0];
  if (!f) return;
  if (isCloudinaryConfigured) {
    try { setPhoto(await uploadImage(f)); return; } catch (err) { /* fall through to base64 */ }
  }
  const r = new FileReader();
  r.onload = ev => setPhoto(ev.target.result);
  r.readAsDataURL(f);
}

const STYLES = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --primary: #9A7B4E;
    --primary-dark: #806340;
    --primary-light: #F3ECE0;
    --bg: #F7F4EF;
    --surface: #FFFFFF;
    --border: #E8E1D6;
    --text: #221E1A;
    --muted: #8A8073;
    --green: #10B981;
    --red: #EF4444;
    --orange: #F59E0B;
    --purple: #B5715A;
    --green-light: #ECFDF5;
    --red-light: #FEF2F2;
    --orange-light: #FFFBEB;
    --purple-light: #F4E9E3;
    --shadow: 0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04);
    --shadow-md: 0 4px 12px rgba(0,0,0,0.08);
    --nav-w: 240px;
    --font: 'Inter', sans-serif;
    --serif: 'Cormorant Garamond', Georgia, serif;
  }
  body { background: var(--bg); color: var(--text); font-family: var(--font); min-height: 100vh; }

  .layout { display: flex; min-height: 100vh; }
  .sidenav { width: var(--nav-w); background: var(--surface); border-right: 1px solid var(--border); display: flex; flex-direction: column; position: fixed; top: 0; left: 0; height: 100vh; z-index: 20; }
  .main { margin-left: var(--nav-w); flex: 1; min-height: 100vh; }
  .nav-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.3); z-index: 19; }
  @media (max-width: 700px) {
    .sidenav { transform: translateX(-100%); transition: transform 0.25s; box-shadow: 2px 0 18px rgba(0,0,0,0.14); }
    .sidenav.open { transform: translateX(0); }
    .main { margin-left: 0; }
    .nav-overlay.show { display: block; }
    .hamburger { display: flex !important; }
    .content { padding: 14px; gap: 12px; }
    .card { padding: 15px; }
    .nav-item { padding: 12px 12px; font-size: 14px; }
    /* 16px inputs prevent iOS Safari from auto-zooming on focus */
    .field-input, .field-select, .pin-input { font-size: 16px; }
    .kpi-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
    .btn-xs { padding: 8px 12px; font-size: 12px; }
    .btn-sm { padding: 9px 15px; font-size: 13px; }
    .user-row { flex-wrap: wrap; gap: 10px; }
    .topbar-date { display: none; }
  }
  /* Tablet / laptop: modal becomes a centered card instead of a bottom sheet */
  @media (min-width: 700px) {
    .modal-overlay { align-items: center; }
    .modal { border-radius: 18px; max-height: 88vh; }
    .modal-handle { display: none; }
  }

  /* SIDENAV */
  .sidenav-brand { padding: 18px 16px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 10px; }
  .brand-logo { width: 38px; height: 38px; background: linear-gradient(135deg, #B0894F, #806340); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; font-family: var(--serif); font-size: 20px; font-weight: 700; flex-shrink: 0; }
  .brand-name { font-family: var(--serif); font-size: 19px; font-weight: 700; letter-spacing: 0.06em; color: var(--text); line-height: 1.1; }
  .brand-sub { font-size: 10px; color: var(--muted); font-weight: 500; }
  .nav-section { padding: 14px 16px 5px; font-size: 10px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em; }
  .nav-item { display: flex; align-items: center; gap: 10px; padding: 9px 12px; margin: 1px 8px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 500; color: var(--muted); border: none; background: none; width: calc(100% - 16px); text-align: left; transition: all 0.12s; }
  .nav-item:hover { background: var(--bg); color: var(--text); }
  .nav-item.active { background: var(--primary-light); color: var(--primary); font-weight: 600; }
  .nav-icon { font-size: 15px; width: 20px; text-align: center; }
  .sidenav-user { padding: 12px 16px; border-bottom: 1px solid var(--border); }
  .user-chip { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
  .avatar { width: 34px; height: 34px; border-radius: 50%; background: linear-gradient(135deg, #9A7B4E, #B5715A); color: white; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; flex-shrink: 0; }
  .user-nm { font-size: 13px; font-weight: 600; }
  .user-rl { font-size: 11px; color: var(--muted); }
  .logout-btn { width: 100%; padding: 8px; font-size: 12px; font-weight: 600; color: var(--red); background: var(--red-light); border: none; border-radius: 8px; cursor: pointer; font-family: var(--font); }

  /* TOPBAR */
  .topbar { background: var(--surface); border-bottom: 1px solid var(--border); padding: 0 20px; height: 56px; display: flex; align-items: center; gap: 12px; position: sticky; top: 0; z-index: 10; box-shadow: var(--shadow); }
  .hamburger { display: none; background: none; border: none; font-size: 20px; cursor: pointer; color: var(--muted); }
  .topbar-title { font-family: var(--serif); font-size: 21px; font-weight: 700; letter-spacing: 0.01em; }
  .topbar-date { font-size: 12px; color: var(--muted); margin-left: auto; }

  /* CONTENT */
  .content { padding: 20px; display: flex; flex-direction: column; gap: 16px; }

  /* CARDS */
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 18px; box-shadow: var(--shadow); }
  .card-title { font-family: var(--serif); font-size: 17px; font-weight: 700; color: var(--text); margin-bottom: 14px; }
  .card-sub { font-size: 11px; color: var(--muted); font-weight: 500; margin-top: 2px; }

  /* KPI ROW */
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  @media (max-width: 900px) { .kpi-grid { grid-template-columns: repeat(2, 1fr); } }
  .kpi-card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 16px; box-shadow: var(--shadow); display: flex; flex-direction: column; gap: 6px; }
  .kpi-icon { width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 17px; margin-bottom: 4px; }
  .kpi-val { font-size: 28px; font-weight: 800; line-height: 1; }
  .kpi-lbl { font-size: 12px; color: var(--muted); font-weight: 500; }
  .kpi-trend { font-size: 11px; font-weight: 600; margin-top: 2px; }

  /* CHART GRID */
  .chart-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  @media (max-width: 900px) { .chart-grid { grid-template-columns: 1fr; } }

  /* FORM */
  .field-label { font-size: 12px; font-weight: 600; color: var(--text); margin-bottom: 6px; }
  .field-input { width: 100%; background: var(--bg); border: 1.5px solid var(--border); border-radius: 8px; padding: 10px 12px; color: var(--text); font-family: var(--font); font-size: 14px; outline: none; transition: border-color 0.15s; }
  .field-input:focus { border-color: var(--primary); background: white; }
  .field-select { width: 100%; background: var(--bg); border: 1.5px solid var(--border); border-radius: 8px; padding: 10px 12px; color: var(--text); font-family: var(--font); font-size: 14px; outline: none; }
  .input-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
  .input-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .cat-ic { width: 38px; height: 38px; border-radius: 10px; background: var(--primary-light); display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
  .entry-tags { display: flex; flex-wrap: wrap; gap: 6px; }
  .entry-tag { font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 20px; background: var(--primary-light); color: var(--primary-dark); }
  .entry-tag.product { background: #F4E9E3; color: #8A5340; }
  .alert-card { display: flex; align-items: center; gap: 14px; background: #FEF2F2; border: 1px solid #F6CDCD; border-radius: 14px; padding: 14px 16px; cursor: pointer; transition: box-shadow 0.15s; }
  .alert-card:hover { box-shadow: var(--shadow-md); }
  .alert-ic { width: 40px; height: 40px; border-radius: 10px; background: #FDE2E2; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
  .alert-title { font-size: 14px; font-weight: 700; color: #B91C1C; }
  .alert-sub { font-size: 12px; color: #8A8073; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .alert-cta { font-size: 12px; font-weight: 700; color: #B91C1C; white-space: nowrap; }
  .input-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .form-group { display: flex; flex-direction: column; }

  /* BUTTONS */
  .btn { padding: 10px 18px; font-family: var(--font); font-size: 13px; border-radius: 8px; cursor: pointer; border: none; font-weight: 600; transition: all 0.12s; }
  .btn-primary { background: var(--primary); color: white; }
  .btn-primary:hover { background: var(--primary-dark); }
  .btn-ghost { background: white; border: 1.5px solid var(--border); color: var(--muted); font-weight: 500; }
  .btn-ghost:hover { border-color: var(--primary); color: var(--primary); }
  .btn-danger { background: var(--red-light); border: none; color: var(--red); }
  .btn-green { background: var(--green-light); border: none; color: var(--green); }
  .btn-sm { padding: 7px 13px; font-size: 12px; }
  .btn-xs { padding: 5px 10px; font-size: 11px; border-radius: 6px; }

  /* BADGES */
  .badge { display: inline-block; font-size: 10px; padding: 3px 9px; border-radius: 20px; font-weight: 600; }
  .badge-do { background: var(--orange-light); color: var(--orange); }
  .badge-po { background: var(--green-light); color: var(--green); }
  .badge-bill { background: var(--purple-light); color: var(--purple); }
  .badge-pending { background: #EFEAE1; color: var(--muted); }
  .badge-reviewed { background: var(--green-light); color: var(--green); }
  .badge-rejected { background: var(--red-light); color: var(--red); }
  .badge-accepted { background: var(--orange-light); color: var(--orange); }
  .badge-arrived { background: var(--primary-light); color: var(--primary-dark); }
  .badge-completed { background: var(--green-light); color: var(--green); }

  /* LOG / DOC / DAMAGE ITEMS */
  .list-item { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px; box-shadow: var(--shadow); display: flex; flex-direction: column; gap: 8px; }
  .item-meta { display: flex; justify-content: space-between; align-items: center; }
  .item-time { font-size: 11px; color: var(--muted); }
  .item-by { font-size: 11px; font-weight: 600; color: var(--primary); background: var(--primary-light); padding: 2px 8px; border-radius: 20px; }
  .nums-row { display: flex; gap: 18px; }
  .num-block { display: flex; align-items: baseline; gap: 4px; }
  .num-val { font-size: 20px; font-weight: 700; }
  .num-lbl { font-size: 10px; color: var(--muted); font-weight: 500; text-transform: uppercase; }

  /* PHOTO */
  .photo-zone { border: 2px dashed var(--border); border-radius: 10px; padding: 20px; text-align: center; cursor: pointer; position: relative; background: var(--bg); }
  .photo-zone:hover { border-color: var(--primary); }
  .photo-zone input { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%; }
  .photo-preview { width: 100%; border-radius: 8px; max-height: 160px; object-fit: cover; }
  .photo-icon { font-size: 26px; margin-bottom: 6px; }
  .photo-lbl { font-size: 12px; color: var(--muted); }

  /* MODAL */
  .modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.45); z-index: 100; display: flex; align-items: flex-end; justify-content: center; }
  .modal { background: white; border-radius: 20px 20px 0 0; width: 100%; max-width: 520px; padding: 10px 20px 40px; display: flex; flex-direction: column; gap: 14px; max-height: 90vh; overflow-y: auto; }
  .modal-handle { width: 40px; height: 4px; background: var(--border); border-radius: 2px; margin: 10px auto 6px; }
  .modal-title { font-size: 17px; font-weight: 700; }
  .modal-actions { display: flex; gap: 8px; margin-top: 4px; }

  /* SECTION HEADER */
  .section-hdr { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px; }
  .section-title { font-size: 14px; font-weight: 700; }

  /* USER ROW */
  .user-row { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; display: flex; justify-content: space-between; align-items: center; box-shadow: var(--shadow); }

  /* EMPTY */
  .empty { text-align: center; padding: 48px 20px; }
  .empty-icon { font-size: 38px; margin-bottom: 10px; }
  .empty-lbl { font-size: 13px; color: var(--muted); font-weight: 500; }

  /* FILTER TABS */
  .filter-tabs { display: flex; gap: 6px; flex-wrap: wrap; }
  .divider { height: 1px; background: var(--border); }

  /* LOGIN */
  .login-page { min-height: 100vh; display: flex; background: var(--surface); }
  .login-left { flex: 1.15; position: relative; display: flex; flex-direction: column; justify-content: space-between; padding: 56px 56px; color: #fff; background: #211E1A; overflow: hidden; }
  .login-left-bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .login-left-shade { position: absolute; inset: 0; background: linear-gradient(165deg, rgba(28,25,21,0.50) 0%, rgba(28,25,21,0.28) 38%, rgba(28,25,21,0.85) 100%); }
  .login-left > .login-top, .login-left > .login-bottom { position: relative; z-index: 1; }
  .login-wordmark { font-family: var(--serif); font-size: 30px; font-weight: 700; letter-spacing: 0.30em; }
  .login-wordmark-sub { font-size: 10px; letter-spacing: 0.34em; text-transform: uppercase; opacity: 0.78; margin-top: 8px; }
  .login-hero { font-family: var(--serif); font-size: 42px; font-weight: 600; line-height: 1.16; max-width: 460px; }
  .login-desc { font-size: 14px; opacity: 0.82; line-height: 1.7; max-width: 380px; margin-top: 16px; }
  .login-features { margin-top: 30px; display: flex; flex-direction: column; gap: 12px; }
  .login-feat { display: flex; align-items: center; gap: 12px; font-size: 13px; opacity: 0.9; }
  .feat-dot { width: 5px; height: 5px; background: #C9A86A; border-radius: 50%; flex-shrink: 0; }
  .login-right { width: 460px; background: var(--surface); display: flex; flex-direction: column; justify-content: center; padding: 56px 56px; }
  @media (max-width: 860px) { .login-left { display: none; } .login-right { width: 100%; padding: 48px 28px; } }
  .login-right-tag { font-family: var(--serif); font-size: 26px; font-weight: 700; letter-spacing: 0.24em; color: var(--text); margin-bottom: 30px; }
  .login-right-title { font-size: 24px; font-weight: 700; color: var(--text); margin-bottom: 4px; }
  .login-right-sub { font-size: 14px; color: var(--muted); margin-bottom: 30px; }
  .login-form { width: 100%; display: flex; flex-direction: column; gap: 18px; }
  .role-row { display: flex; gap: 8px; }
  .role-btn { flex: 1; padding: 11px; border: 1.5px solid var(--border); background: var(--bg); color: var(--muted); font-family: var(--font); font-size: 13px; font-weight: 500; border-radius: 10px; cursor: pointer; transition: all 0.12s; }
  .role-btn.active { border-color: var(--primary); background: var(--primary-light); color: var(--primary-dark); font-weight: 700; }
  .pin-input { width: 100%; background: var(--bg); border: 1.5px solid var(--border); border-radius: 10px; padding: 13px 14px; color: var(--text); font-family: var(--font); font-size: 15px; letter-spacing: 0.04em; text-align: center; outline: none; transition: border-color 0.15s, background 0.15s; }
  .pin-input::placeholder { letter-spacing: normal; color: #B6AE9F; font-size: 14px; }
  .pin-input:focus { border-color: var(--primary); background: #fff; }
  .login-btn { width: 100%; padding: 15px; font-family: var(--font); font-size: 15px; font-weight: 700; letter-spacing: 0.02em; color: #fff; background: var(--primary); border: none; border-radius: 10px; cursor: pointer; transition: background 0.15s; }
  .login-btn:hover { background: var(--primary-dark); }
  .login-err { font-size: 12px; color: var(--red); background: var(--red-light); padding: 10px 14px; border-radius: 8px; font-weight: 500; text-align: center; }
  .pin-hint { font-size: 11px; color: var(--muted); text-align: center; letter-spacing: 0.02em; }

  /* RECHARTS */
  .recharts-tooltip-wrapper { outline: none; }
  .custom-tooltip { background: white; border: 1px solid var(--border); border-radius: 10px; padding: 10px 14px; box-shadow: var(--shadow-md); font-family: var(--font); font-size: 12px; }
  .tooltip-label { font-weight: 700; color: var(--text); margin-bottom: 6px; font-size: 11px; }
  .tooltip-row { display: flex; align-items: center; gap: 6px; margin-top: 3px; }
  .tooltip-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }

  /* NOTICE BOARD */
  .notice-card { border: 1px solid var(--border); border-radius: 12px; padding: 12px 14px; margin-top: 10px; background: var(--bg); }
  .notice-hdr { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; flex-wrap: wrap; }
  .notice-title { font-size: 14px; font-weight: 700; }
  .notice-meta { font-size: 11px; color: var(--muted); margin-top: 2px; }
  .notice-msg { font-size: 13px; color: var(--text); margin-top: 8px; line-height: 1.55; white-space: pre-wrap; }
  .notice-roster { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
  .notice-avatar { position: relative; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: white; background: #C9BFAF; opacity: 0.55; }
  .notice-avatar.acked { background: linear-gradient(135deg, #9A7B4E, #B5715A); opacity: 1; box-shadow: 0 0 0 2px var(--green-light); }
  .notice-check { position: absolute; bottom: -2px; right: -2px; background: var(--green); color: white; border-radius: 50%; width: 14px; height: 14px; font-size: 9px; display: flex; align-items: center; justify-content: center; border: 2px solid var(--surface); }

  /* TARGETS */
  .target-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; }
  .target-lbl { font-size: 12px; color: var(--muted); font-weight: 500; }
  .target-val { font-size: 13px; font-weight: 700; color: var(--text); }
  .target-bar { height: 8px; border-radius: 6px; background: var(--bg); overflow: hidden; }
  .target-fill { height: 100%; background: linear-gradient(90deg, #9A7B4E, #B5715A); border-radius: 6px; transition: width 0.3s; }

  /* MY DEALERS */
  .dealer-card { border: 1px solid var(--border); border-radius: 12px; padding: 12px 14px; margin-top: 10px; background: var(--bg); }
  .dealer-hdr { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
  .dealer-map { width: 100%; height: 160px; border: 1px solid var(--border); border-radius: 10px; }

  /* SALES CALENDAR */
  .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px; }
  .cal-wd { font-size: 10.5px; font-weight: 700; color: var(--muted); text-align: center; padding: 4px 0 8px; text-transform: uppercase; letter-spacing: 0.04em; }
  .cal-cell { width: 100%; min-height: 76px; border-radius: 10px; background: var(--bg); border: 1.5px solid transparent; padding: 6px 6px; display: flex; flex-direction: column; gap: 4px; align-items: flex-start; font-family: var(--font); cursor: default; transition: box-shadow 0.12s, border-color 0.12s; }
  .cal-cell.empty { background: transparent; }
  .cal-cell.today { border-color: var(--primary); }
  .cal-cell.today .cal-day-num { color: var(--primary-dark); }
  .cal-cell.selected { border-color: var(--primary); box-shadow: var(--shadow-md); }
  .cal-cell.has-activity { cursor: pointer; }
  .cal-day-num { font-size: 15px; font-weight: 700; color: var(--text); }
  .cal-pills { display: flex; flex-direction: column; gap: 3px; width: 100%; }
  .cal-pill { font-size: 11px; font-weight: 700; border-radius: 6px; padding: 2px 6px; display: flex; align-items: center; gap: 3px; white-space: nowrap; }
  .cal-pill.d { color: #9A7B4E; background: rgba(255,255,255,0.6); }
  .cal-pill.r { color: #B5715A; background: rgba(255,255,255,0.6); }
  .cal-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px; vertical-align: middle; }
  .cal-dot.d { background: #9A7B4E; }
  .cal-dot.r { background: #B5715A; }
  .cal-detail { margin-top: 14px; border-top: 1px solid var(--border); padding-top: 14px; }
  .cal-detail-hdr { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
  .cal-detail-row { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 10px 0; border-top: 1px solid var(--border); }
  .cal-detail-row:first-of-type { border-top: none; }
  @media (max-width: 700px) { .cal-cell { min-height: 62px; padding: 5px; } .cal-day-num { font-size: 13px; } .cal-pill { font-size: 9.5px; padding: 1px 4px; } }
`;

// ── SEED DATA ──────────────────────────────────────────────────────────────────
const SEED_STAFF = ["Ali", "Raju", "Wei", "Marcus"];
const SEED_DEALERS = ["One9supplies Pte Ltd", "ABC Construction", "BuildRight Pte Ltd", "Summit Renovation"];
const SEED_PRODUCTS = [
  ["150mm S-Trap Model One Toilet Bowl", 198],
  ["250mm S-Trap Model One Toilet Bowl", 198],
  ["180mm P-Trap Model One Toilet Bowl", 198],
  ["150mm S-Trap Model One (WDI)", 160],
  ["Flexible Pan Collar (FLC)", 210],
  ["CushRinse PP Bidet Seat Cover (M1FG-BC)", 70],
];
const seedLogs = (() => {
  const entries = [];
  let seq = 1;
  for (let i = 20; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const iso = d.toISOString().split("T")[0];
    const label = d.toLocaleDateString("en-SG", { day: "2-digit", month: "short", year: "numeric" });
    const orders = 1 + Math.floor(Math.random() * 2);
    for (let k = 0; k < orders; k++) {
      const [product, price] = SEED_PRODUCTS[Math.floor(Math.random() * SEED_PRODUCTS.length)];
      const num = String(123000 + seq);
      entries.push({
        id: 900000 + seq,
        dealer: SEED_DEALERS[Math.floor(Math.random() * SEED_DEALERS.length)],
        product, price,
        sold: 3 + Math.floor(Math.random() * 20),
        returned: Math.random() < 0.2 ? 1 + Math.floor(Math.random() * 2) : 0,
        exchanged: Math.random() < 0.15 ? 1 : 0,
        notes: "", photo: null,
        by: SEED_STAFF[Math.floor(Math.random() * SEED_STAFF.length)],
        date: label, dateISO: iso, time: "09:00",
        poNo: "PO-" + num, doNo: "DO-" + num,
      });
      seq++;
    }
  }
  return entries;
})();

const seedDamages = [
  { id: 910001, itemDesc: "WC Unit Model A", qty: 2, notes: "Cracked lid", photo: null, by: "Ali", date: "01 Jun 2026", dateISO: "2026-06-01", status: "pending" },
  { id: 910002, itemDesc: "WC Seat Cover", qty: 1, notes: "Broken hinge", photo: null, by: "Raju", date: "10 Jun 2026", dateISO: "2026-06-10", status: "reviewed" },
];

const seedDocs = [
  { id: 920001, type: "DO", refNo: "DO-2026-001", party: "ABC Construction", amount: "1200.00", notes: "", photo: null, by: "Ali", date: "05 Jun 2026", dateISO: "2026-06-05" },
  { id: 920002, type: "PO", refNo: "PO-2026-003", party: "WC Supplies Pte Ltd", amount: "4500.00", notes: "", photo: null, by: "Admin", date: "12 Jun 2026", dateISO: "2026-06-12" },
  { id: 920003, type: "BILL", refNo: "INV-060-2026", party: "Logistics Co", amount: "890.00", notes: "June billing", photo: null, by: "Admin", date: "15 Jun 2026", dateISO: "2026-06-15" },
];

// Notice board — admin-posted announcements that salespeople acknowledge.
const initNotices = [
  { id: 1, title: "Welcome to Velle Inventory Management", message: "Please review your daily orders each morning and acknowledge this notice so Admin knows you're up to date.", by: "Terence", date: "01 Jul 2026", dateISO: "2026-07-01", ackBy: [] },
];

const initUsers = [
  { id: 1, pin: "1234", role: "admin", name: "Terence" },
  { id: 2, pin: "0001", role: "salesperson", name: "Ali" },
  { id: 3, pin: "0002", role: "salesperson", name: "Raju" },
  { id: 4, pin: "0003", role: "salesperson", name: "Wei" },
  { id: 5, pin: "0004", role: "salesperson", name: "Marcus" },
  { id: 6, pin: "5001", role: "installer", name: "BrightFix Installations" },
];

// Built-in super admin (not stored in the database, so it always works).
// Change this PIN to whatever you like.
const SUPER_PIN = "9999";

// Company details shown on PO/DO/Tax Invoice documents — edit in SuperAdmin → Company Settings.
const DEFAULT_COMPANY_SETTINGS = {
  name: "Velle Pte. Ltd.",
  addr1: "55 Lorong L Telok Kurau",
  addr2: "#02-57 Bright Centre, Singapore",
  phone: "+65 9145 7739",
  email: "",
  website: "",
  uen: "202439003W",
  gst: "202439003W",
};

// Shared running PO/DO number series — edit in SuperAdmin → Company Settings.
// Every new Sales Order or Installer Job draws the next number from here.
const DEFAULT_DOC_COUNTERS = { poPrefix: "PO-", doPrefix: "DO-", poNext: 123031, doNext: 123031 };

// Starter dealer & product lists — edit these on the Dealers / Products pages.
const initDealers = [
  { id: 1, name: "One9supplies Pte Ltd", contactName: "Jason Lim", contactPhone: "9123 4567", address: "21 Woodlands Close, #03-15, Singapore 737854", salesperson: "Ali", createdAt: "2026-06-01T09:00:00.000Z" },
  { id: 2, name: "ABC Construction", contactName: "Priya Nair", contactPhone: "8234 5678", address: "5 Toa Payoh Industrial Park, #02-08, Singapore 319058", salesperson: "Ali", createdAt: "2026-06-03T09:00:00.000Z" },
  { id: 3, name: "BuildRight Pte Ltd", contactName: "Wong Kah Meng", contactPhone: "9345 6789", address: "88 Kaki Bukit Road 4, #04-22, Singapore 417839", salesperson: "Raju", createdAt: "2026-06-10T09:00:00.000Z" },
  { id: 4, name: "Summit Renovation", contactName: "Farah Aziz", contactPhone: "8456 7890", address: "12 Ubi Crescent, #01-05, Singapore 408563", salesperson: "Wei", createdAt: "2026-06-20T09:00:00.000Z" },
];
const initProducts = [
  { id: 1, name: "150mm S-Trap Model One Toilet Bowl", price: 198, stock: 40, threshold: 10 },
  { id: 2, name: "250mm S-Trap Model One Toilet Bowl", price: 198, stock: 30, threshold: 10 },
  { id: 3, name: "180mm P-Trap Model One Toilet Bowl", price: 198, stock: 24, threshold: 8 },
  { id: 4, name: "150mm S-Trap Model One (WDI)", price: 160, stock: 20, threshold: 8 },
  { id: 5, name: "Flexible Pan Collar (FLC)", price: 210, stock: 60, threshold: 15 },
  { id: 6, name: '1" Offset Pan Collar (IN-1)', price: 0, stock: 100, threshold: 20 },
  { id: 7, name: "Aqua-Float Wall Hung Toilet Bowl (HWC-001)", price: 380, stock: 6, threshold: 6 },
  { id: 8, name: "CushRinse PP Bidet Seat Cover (M1FG-BC)", price: 70, stock: 25, threshold: 8 },
];

// Full catalogue paste-in for Products → Bulk Add (prefilled as a convenience — edit or replace as needed).
const PRESET_BULK_PRODUCTS = [
  "150mm S Trap Velle Model One Toilet Bowl",
  "250mm S Trap Velle Model One Toilet Bowl",
  "180mm P Trap Velle Model One Toilet Bowl",
  "150mm S Trap Velle Model One Toilet Bowl - WDI",
  "250mm S Trap Velle Model One Toilet Bowl - WDI",
  "180mm P Trap Velle Model One Toilet Bowl - WDI",
  "150mm S Trap Velle Model One Toilet Bowl - Returned Broken / Defective",
  "250mm S Trap Velle Model One Toilet Bowl - Returned Broken / Defective",
  "180mm P Trap Velle Model One Toilet Bowl - Returned Broken / Defective",
  "150mm S Trap Velle Model One Toilet Bowl - Factory Broken / Defective",
  "250mm S Trap Velle Model One Toilet Bowl - Factory Broken / Defective",
  "180mm P Trap Velle Model One Toilet Bowl - Factory Broken / Defective",
  "150mm S Trap Velle Model One Toilet Bowl - WDI - Returned Broken / Defective",
  "250mm S Trap Velle Model One Toilet Bowl - WDI - Returned Broken / Defective",
  "180mm P Trap Velle Model One Toilet Bowl - WDI - Returned Broken / Defective",
  "Aqua - Float Wall Hung Toilet Bowl - HWC-001",
  "Aqua - Glide Wall Hung Toilet Bowl - HWC-002",
  "Geberit Cistern Set",
  "WDI Cistern Set",
  "NeoRinse ( M1FG-SC ) UF Seat Cover",
  "CushRinse ( M1FG-BC ) PP Bidet Seat Cover",
  "UF Seat Cover Screw ( M1FG-SCS )",
  "UF Seat Cover Fitting ( M1FG-SCF )",
  '1" Offset Pan Collar ( IN-1 )',
  '2" Offset Pan Collar ( IN-2 )',
  "Flexible Pan Collar ( FLC )",
  "Straight Pan Collar",
  "Rigid A Collar ( RC-1 )",
  "Rigid B Collar ( RC-2 )",
  "Rigid C Collar ( RC-3 )",
  "150mm S Trap Velle Model One Toilet Bowl ( Display Piece )",
  "250mm S Trap Velle Model One Toilet Bowl ( Display Piece )",
  "180mm P Trap Velle Model One Toilet Bowl ( Display Piece )",
  "NeoRinse ( M1FG-SC ) UF Seat Cover ( Display Piece )",
  "CushRinse ( M1FG-BC ) PP Bidet Seat Cover ( Display Piece )",
  "Aqua - Float Wall Hung Toilet Bowl ( Display Piece )",
  "Aqua - Glide Wall Hung Toilet Bowl ( Display Piece )",
  '1" Offset Pan Collar 32 + 4pcs Package',
  '2" Offset Pan Collar 32 + 4pcs Package',
];

// Daily tasks / servicing jobs.
const initTasks = [
  { id: 1, title: "Service leaking basin mixer", type: "Servicing", details: "Site: ABC Construction, Blk 12", date: "01 Jul 2026", dateISO: "2026-07-01", by: "Admin", status: "open" },
  { id: 2, title: "Deliver 5 One-Piece WC to Summit", type: "Task", details: "", date: "01 Jul 2026", dateISO: "2026-07-01", by: "Admin", status: "open" },
];

// Per-salesperson targets, set by Admin: new dealers to approach each week, and a monthly sales dollar target.
const initTargets = [
  { id: 1, salesperson: "Ali", newDealerWeekly: 2, salesMonthly: 15000 },
  { id: 2, salesperson: "Raju", newDealerWeekly: 2, salesMonthly: 15000 },
  { id: 3, salesperson: "Wei", newDealerWeekly: 2, salesMonthly: 15000 },
  { id: 4, salesperson: "Marcus", newDealerWeekly: 2, salesMonthly: 15000 },
];

// Expense claims (e.g. treats bought for a dealer meetup) — need Admin approval before counting as an expense.
const seedClaims = [
  { id: 960001, amount: "45.00", dealer: "ABC Construction", notes: "Coffee & pastries for showroom meetup", photo: null, by: "Ali", date: "20 Jun 2026", dateISO: "2026-06-20", status: "pending" },
];

// Finance: money paid out to restock suppliers, and generated monthly dealer tax invoices (AR).
const seedSupplierPayments = [
  { id: 970001, supplier: "WC Supplies Pte Ltd", amount: "8200.00", notes: "June restock — toilet bowls & fittings", date: "10 Jun 2026", dateISO: "2026-06-10", by: "Terence" },
];
const seedInvoices = [];
const GST_RATE = 0.09;
const daysOverdue = dueISO => Math.floor((Date.now() - new Date(dueISO + "T00:00:00").getTime()) / 86400000);
const agingBucket = days => days <= 0 ? "Not due" : days <= 30 ? "1–30 days" : days <= 60 ? "31–60 days" : days <= 90 ? "61–90 days" : "90+ days";

// Installation jobs — admin creates & assigns to an installer company, who accepts
// and completes them with arrival (geo+time stamped) and completion photos.
const JOB_STATUS_LABEL = { pending: "Pending Acceptance", accepted: "Accepted", arrived: "Arrived On-Site", completed: "Completed" };
const seedInstallJobs = [
  { id: 940001, poNo: "PO-123031", doNo: "DO-123031", product: "150mm S-Trap Model One Toilet Bowl", qty: 2,
    address: "12 Bishan Street 22, #05-10, Singapore 570012", collectPoint: "Velle Warehouse, 55 Lorong L Telok Kurau",
    date: "05 Jul 2026", dateISO: "2026-07-05", timeFrom: "14:00", timeTo: "17:00",
    installer: "BrightFix Installations", status: "pending", createdBy: "Terence", createdAt: "2026-07-01T09:00:00.000Z",
    arrivalPhoto: null, arrivalMeta: null, completionPhoto: null, completionMeta: null },
];
const fmt12h = hhmm => {
  if (!hhmm) return "—";
  const [h, m] = hhmm.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${String(m).padStart(2, "0")} ${ap}`;
};

const fmtDate = d => d.toLocaleDateString("en-SG", { day: "2-digit", month: "short", year: "numeric" });
const fmtTime = () => new Date().toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit" });
const todayStr = () => fmtDate(new Date());
const todayISO = () => new Date().toISOString().split("T")[0];

// Start-of-period ISO date (Monday-based week) for daily/weekly/monthly/yearly filtering.
const periodStartISO = (p) => {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  if (p === "week") d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  else if (p === "month") d.setDate(1);
  else if (p === "year") d.setMonth(0, 1);
  return d.toISOString().split("T")[0];
};
const sgd = n => "$" + Number(n || 0).toLocaleString("en-SG", { maximumFractionDigits: 0 });

const SALES_ROLES = ["salesperson", "admin", "superadmin"];
const NAV = [
  { id: "dashboard", label: "Dashboard", icon: "📊", admin: false, roles: SALES_ROLES },
  { id: "daily", label: "Orders", icon: "📝", admin: false, roles: SALES_ROLES },
  { id: "damage", label: "Damage Returns", icon: "⚠️", admin: false, roles: SALES_ROLES },
  { id: "documents", label: "Documents", icon: "📄", admin: false, roles: SALES_ROLES },
  { id: "tasks", label: "Tasks & Servicing", icon: "🧰", admin: false, roles: SALES_ROLES },
  { id: "claims", label: "My Claims", icon: "🧾", admin: false, roles: SALES_ROLES },
  { id: "install-jobs-mine", label: "My Jobs", icon: "🛠️", admin: false, roles: ["installer"] },
  { id: "trash", label: "Trash", icon: "🗑️", admin: false },
  { id: "reports", label: "Reports", icon: "📈", admin: true },
  { id: "damage-review", label: "Damage Review", icon: "🔍", admin: true },
  { id: "doc-overview", label: "Doc Overview", icon: "🗂️", admin: true },
  { id: "stock", label: "Stock Summary", icon: "📦", admin: true },
  { id: "dealers", label: "Dealers", icon: "🤝", admin: true },
  { id: "products", label: "Products", icon: "🛁", admin: true },
  { id: "install-jobs", label: "Installation Jobs", icon: "🛠️", admin: true },
  { id: "claims-review", label: "Claims Review", icon: "🧾", admin: true },
  { id: "targets", label: "Sales Targets", icon: "🎯", admin: true },
  { id: "finance", label: "Finance", icon: "💰", admin: true },
  { id: "users", label: "User Management", icon: "👥", admin: true },
  { id: "company-settings", label: "Company Settings", icon: "🏢", admin: true, super: true },
  { id: "balance-sheet", label: "Balance Sheet", icon: "📒", admin: true, super: true },
  { id: "system", label: "Data Management", icon: "🗄️", admin: true, super: true },
];

const CHART_COLORS = ["#9A7B4E", "#10B981", "#F59E0B", "#B5715A", "#EF4444"];

// ── LOGIN HERO IMAGES ────────────────────────────────────────────────────────
// One of these is picked at random every time the login screen mounts
// (i.e. on each page refresh / sign-out), giving a fresh bathroom on each visit.
//
// ⚠️  PLACEHOLDERS: these are stock luxury-bathroom photos, NOT Velle products.
//     I could not pull Velle's own photos — their Instagram is login-gated and
//     their website refuses programmatic connections. To use only Velle products:
//     download ~20 images from instagram.com/vellebathware into /public/heroes/
//     and replace the URLs below with "/heroes/01.jpg", "/heroes/02.jpg", … —
//     or paste the image URLs here and I'll wire them in.
const HERO_IMG = id => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1600&q=80`;
const HERO_FALLBACK = HERO_IMG("1604709177225-055f99402ea3");
const HERO_IMAGES = [
  "1604709177225-055f99402ea3", "1620626011761-996317b8d101", "1584622650111-993a426fbf0a",
  "1631889993959-41b4e9c6e3c5", "1507652313519-d4e9174996dd", "1661107259637-4e1c55462428",
  "1576698483491-8c43f0862543", "1696987007764-7f8b85dd3033", "1603825491103-bd638b1873b0",
  "1733426107854-ee00a25d72a7", "1638799869566-b17fa794c4de", "1564540583246-934409427776",
  "1572742482459-e04d6cfdd6f3", "1651951646668-46562cfb4518", "1531125227120-bac862d2aeb9",
  "1581783748410-2c5377ad72ee", "1564540579594-0930edb6de43", "1629079447777-1e605162dc8d",
  "1643949719317-4342d8d4031e", "1521783593447-5702b9bfd267", "1650894622076-e09ab837c502",
  "1595514535116-d0401260e7cf", "1600488999585-e4364713b90a", "1628602813485-4e8b09442e98",
].map(HERO_IMG);

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip">
      <div className="tooltip-label">{label}</div>
      {payload.map((p, i) => (
        <div className="tooltip-row" key={i}>
          <div className="tooltip-dot" style={{ background: p.color }} />
          <span style={{ color: "#8A8073" }}>{p.name}:</span>
          <strong style={{ color: "#221E1A" }}>{p.value}</strong>
        </div>
      ))}
    </div>
  );
}

// ── APP ────────────────────────────────────────────────────────────────────────
export default function App() {
  // Restore the signed-in user from local storage so a browser refresh doesn't log out.
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("velle_user")) || null; } catch { return null; }
  });
  useEffect(() => {
    if (user) localStorage.setItem("velle_user", JSON.stringify(user));
    else localStorage.removeItem("velle_user");
  }, [user]);
  // Installers land on their job list, not the sales dashboard.
  const [page, setPage] = useState(() => (user?.role === "installer" ? "install-jobs-mine" : "dashboard"));
  const [navOpen, setNavOpen] = useState(false);
  const [users, setUsers] = usePersistentState("users", initUsers);
  const [logs, setLogs] = usePersistentState("logs", seedLogs);
  const [damages, setDamages] = usePersistentState("damages", seedDamages);
  const [docs, setDocs] = usePersistentState("docs", seedDocs);
  const [modal, setModal] = useState(null);
  const [docType, setDocType] = useState("DO");
  const [editUser, setEditUser] = useState(null);
  const [dealers, setDealers] = usePersistentState("dealers", initDealers);
  const [products, setProducts] = usePersistentState("products", initProducts);
  const [editDealer, setEditDealer] = useState(null);
  const [editProduct, setEditProduct] = useState(null);
  const [tasks, setTasks] = usePersistentState("tasks", initTasks);
  const [editTask, setEditTask] = useState(null);
  const [lastOrder, setLastOrder] = useState(null);
  const [trash, setTrash] = usePersistentState("trash", []);
  const [notices, setNotices] = usePersistentState("notices", initNotices);
  const [companySettings, setCompanySettings] = usePersistentState("companySettings", DEFAULT_COMPANY_SETTINGS);
  const [docCounters, setDocCounters] = usePersistentState("docCounters", DEFAULT_DOC_COUNTERS);
  const [installJobs, setInstallJobs] = usePersistentState("installJobs", seedInstallJobs);
  const [targets, setTargets] = usePersistentState("targets", initTargets);
  const [claims, setClaims] = usePersistentState("claims", seedClaims);
  const [supplierPayments, setSupplierPayments] = usePersistentState("supplierPayments", seedSupplierPayments);
  const [invoices, setInvoices] = usePersistentState("invoices", seedInvoices);

  // Keep the PDF generator's company block in sync with SuperAdmin's settings.
  useEffect(() => { setCompanyInfo(companySettings); }, [companySettings]);

  // Auto-purge trash items older than 90 days. Runs whenever trash changes
  // (including on first load), and is a no-op once nothing is expired.
  useEffect(() => {
    if (!trash.length) return;
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const kept = trash.filter(t => new Date(t.deletedAt).getTime() > cutoff);
    if (kept.length !== trash.length) setTrash(kept);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trash]);

  // Shared running PO/DO series (set in SuperAdmin → Company Settings). Used by both
  // Sales Orders and Installer Jobs so every document draws from one running number.
  const allocateDocNumbers = () => {
    const poNo = `${docCounters.poPrefix}${docCounters.poNext}`;
    const doNo = `${docCounters.doPrefix}${docCounters.doNext}`;
    setDocCounters({ ...docCounters, poNext: docCounters.poNext + 1, doNext: docCounters.doNext + 1 });
    return { poNo, doNo };
  };

  // Saving a New Order: record it and adjust warehouse stock (delivered out, returned back).
  const handlePurchase = e => {
    const withDocs = { ...e, ...allocateDocNumbers() };
    setLogs([withDocs, ...logs]);
    const delivered = Number(e.sold) || 0;
    const returned = Number(e.returned) || 0;
    if (e.product && (delivered || returned)) {
      setProducts(ps => ps.map(p => p.name.toLowerCase() === e.product.toLowerCase() ? { ...p, stock: (Number(p.stock) || 0) - delivered + returned } : p));
    }
    setLastOrder(withDocs);
    setModal("order-created");
  };

  // ── INSTALLATION JOBS ──
  const createInstallJob = payload => {
    const job = { id: Date.now(), ...allocateDocNumbers(), status: "pending", createdBy: user.name, createdAt: new Date().toISOString(), arrivalPhoto: null, arrivalMeta: null, completionPhoto: null, completionMeta: null, ...payload };
    setInstallJobs([job, ...installJobs]);
    setModal(null);
  };
  const acceptInstallJob = jobId => setInstallJobs(installJobs.map(j => j.id === jobId ? { ...j, status: "accepted", acceptedAt: new Date().toISOString() } : j));
  // Arrival photo: captures the unit number, timestamp and (if permitted) GPS location.
  const captureArrivalJobPhoto = (jobId, file) => {
    const finish = (photoUrl, coords) => setInstallJobs(jobs => jobs.map(j => j.id === jobId ? {
      ...j, status: "arrived", arrivalPhoto: photoUrl,
      arrivalMeta: { takenAt: new Date().toISOString(), lat: coords?.latitude ?? null, lng: coords?.longitude ?? null, accuracy: coords?.accuracy ?? null },
    } : j));
    const withPhoto = photoUrl => {
      if (navigator.geolocation) navigator.geolocation.getCurrentPosition(pos => finish(photoUrl, pos.coords), () => finish(photoUrl, null), { timeout: 8000, enableHighAccuracy: true });
      else finish(photoUrl, null);
    };
    if (isCloudinaryConfigured) uploadImage(file).then(withPhoto).catch(() => { const r = new FileReader(); r.onload = ev => withPhoto(ev.target.result); r.readAsDataURL(file); });
    else { const r = new FileReader(); r.onload = ev => withPhoto(ev.target.result); r.readAsDataURL(file); }
  };
  // Completion photo: the installed product, once the job is done.
  const captureCompletionJobPhoto = (jobId, file) => {
    const finish = photoUrl => setInstallJobs(jobs => jobs.map(j => j.id === jobId ? { ...j, status: "completed", completionPhoto: photoUrl, completionMeta: { takenAt: new Date().toISOString() } } : j));
    if (isCloudinaryConfigured) uploadImage(file).then(finish).catch(() => { const r = new FileReader(); r.onload = ev => finish(ev.target.result); r.readAsDataURL(file); });
    else { const r = new FileReader(); r.onload = ev => finish(ev.target.result); r.readAsDataURL(file); }
  };

  if (!user) return <LoginScreen users={users} onLogin={u => { setUser(u); setPage(u.role === "installer" ? "install-jobs-mine" : "dashboard"); }} />;

  const go = id => { setPage(id); setNavOpen(false); };
  const isSuperAdmin = user.role === "superadmin";
  const isAdmin = user.role === "admin" || isSuperAdmin;

  // Super-admin data tools. Business data is reset; user accounts are left alone.
  const loadTestData = () => {
    setUsers(initUsers);
    setLogs(seedLogs); setDamages(seedDamages); setDocs(seedDocs);
    setDealers(initDealers); setProducts(initProducts); setTasks(initTasks);
    setTrash([]); setNotices(initNotices); setInstallJobs(seedInstallJobs); setTargets(initTargets); setClaims(seedClaims);
    setSupplierPayments(seedSupplierPayments); setInvoices(seedInvoices);
  };
  const clearAllData = () => {
    setLogs([]); setDamages([]); setDocs([]); setDealers([]); setProducts([]); setTasks([]);
    setTrash([]); setNotices([]); setInstallJobs([]); setTargets([]); setClaims([]);
    setSupplierPayments([]); setInvoices([]);
  };

  // ── TRASH ──
  // Deleting anywhere in the app routes here instead of removing outright:
  // the item moves to Trash (kept 90 days), tagged with who deleted it.
  const trashItem = (kind, item) => setTrash([{ trashId: Date.now() + Math.random(), kind, item, by: user.name, deletedAt: new Date().toISOString() }, ...trash]);
  const collections = { order: [logs, setLogs], damage: [damages, setDamages], document: [docs, setDocs], dealer: [dealers, setDealers], product: [products, setProducts], task: [tasks, setTasks], user: [users, setUsers] };
  const restoreTrash = trashId => {
    const t = trash.find(x => x.trashId === trashId);
    if (!t) return;
    const [list, setList] = collections[t.kind] || [];
    if (setList) setList([t.item, ...list]);
    setTrash(trash.filter(x => x.trashId !== trashId));
  };
  const permanentDelete = trashId => setTrash(trash.filter(x => x.trashId !== trashId));
  const emptyTrash = () => setTrash([]);
  const deleteLog = log => { setLogs(logs.filter(l => l !== log)); trashItem("order", log); };
  const deleteDamage = d => { setDamages(damages.filter(x => x !== d)); trashItem("damage", d); };
  const deleteDoc = d => { setDocs(docs.filter(x => x !== d)); trashItem("document", d); };

  // ── NOTICE BOARD ──
  const postNotice = (title, message) => setNotices([{ id: Date.now(), title, message, by: user.name, date: todayStr(), dateISO: todayISO(), ackBy: [] }, ...notices]);
  const acknowledgeNotice = id => setNotices(notices.map(n => {
    if (n.id !== id || (n.ackBy || []).some(a => a.name === user.name)) return n;
    return { ...n, ackBy: [...(n.ackBy || []), { name: user.name, at: new Date().toISOString() }] };
  }));

  // ── FINANCE ──
  const addSupplierPayment = payload => setSupplierPayments([{ id: Date.now(), by: user.name, ...payload }, ...supplierPayments]);
  // Builds a tax invoice for one dealer's net orders in a given month, saves it, and returns it for immediate PDF download.
  const generateInvoice = (dealer, monthISO) => {
    const monthLogs = logs.filter(l => l.dealer === dealer && l.dateISO && l.dateISO.slice(0, 7) === monthISO);
    const lines = monthLogs.map(l => {
      const qty = (Number(l.sold) || 0) - (Number(l.returned) || 0);
      const price = Number(l.price) || 0;
      return qty > 0 ? { poNo: l.poNo, doNo: l.doNo, model: l.product, qty, price, amount: qty * price } : null;
    }).filter(Boolean);
    const subtotal = lines.reduce((s, l) => s + l.amount, 0);
    const gst = subtotal * GST_RATE;
    const total = subtotal + gst;
    const issueDateISO = todayISO();
    const due = new Date(); due.setDate(due.getDate() + 30);
    const monthLabel = new Date(monthISO + "-01").toLocaleDateString("en-SG", { month: "long", year: "numeric" });
    const invoice = {
      id: Date.now(), refNo: `INV-${monthISO.replace("-", "")}-${String(Date.now()).slice(-4)}`,
      dealer, monthISO, monthLabel, lines, subtotal, gst, gstRate: GST_RATE, total,
      issueDate: todayStr(), issueDateISO, dueDate: fmtDate(due), dueDateISO: due.toISOString().split("T")[0],
      status: "unpaid", paidDateISO: null, by: user.name,
    };
    setInvoices([invoice, ...invoices]);
    return invoice;
  };
  const markInvoicePaid = id => setInvoices(invoices.map(i => i.id === id ? { ...i, status: "paid", paidDateISO: todayISO() } : i));

  return (
    <>
      <style>{STYLES}</style>
      <div className="layout">
        {navOpen && <div className="nav-overlay show" onClick={() => setNavOpen(false)} />}
        <div className={`sidenav ${navOpen ? "open" : ""}`}>
          <div className="sidenav-brand">
            <div className="brand-logo">V</div>
            <div><div className="brand-name">Velle</div><div className="brand-sub">Inventory Management</div></div>
          </div>
          <div className="sidenav-user">
            <div className="user-chip">
              <div className="avatar">{user.name[0]}</div>
              <div style={{ minWidth: 0 }}><div className="user-nm">{user.name}</div><div className="user-rl">{user.role}</div></div>
            </div>
            <button className="logout-btn" onClick={() => setUser(null)}>Sign out</button>
          </div>
          <div style={{ overflowY: "auto", flex: 1, paddingBottom: 8 }}>
            <div className="nav-section">General</div>
            {NAV.filter(n => !n.admin && (!n.roles || n.roles.includes(user.role))).map(n => (
              <button key={n.id} className={`nav-item ${page === n.id ? "active" : ""}`} onClick={() => go(n.id)}>
                <span className="nav-icon">{n.icon}</span>{n.label}
              </button>
            ))}
            {isAdmin && <>
              <div className="nav-section">Admin</div>
              {NAV.filter(n => n.admin && (!n.super || isSuperAdmin)).map(n => (
                <button key={n.id} className={`nav-item ${page === n.id ? "active" : ""}`} onClick={() => go(n.id)}>
                  <span className="nav-icon">{n.icon}</span>{n.label}
                </button>
              ))}
            </>}
          </div>
        </div>

        <div className="main">
          <div className="topbar">
            <button className="hamburger" onClick={() => setNavOpen(o => !o)}>☰</button>
            <div className="topbar-title">{NAV.find(n => n.id === page)?.label || "Dashboard"}</div>
            <div className="topbar-date">{todayStr()}</div>
          </div>

          {page === "dashboard" && <DashboardPage logs={logs} damages={damages} docs={docs} products={products} users={users} notices={notices} dealers={dealers} targets={targets} isAdmin={isAdmin} me={user.name} onAdd={() => setModal("log")} onGoStock={() => go("products")} onAck={acknowledgeNotice} onPostNotice={() => setModal("notice")} />}
          {page === "daily" && <DailyPage logs={logs} me={user.name} isAdmin={isAdmin} onAdd={() => setModal("log")} onDelete={deleteLog} />}
          {page === "damage" && <DamagePage damages={damages} me={user.name} isAdmin={isAdmin} onAdd={() => setModal("damage")} onDelete={deleteDamage} />}
          {page === "documents" && <DocumentsPage docs={docs} me={user.name} isAdmin={isAdmin} onAdd={t => { setDocType(t); setModal("doc"); }} onDelete={deleteDoc} />}
          {page === "reports" && <ReportsPage logs={logs} />}
          {page === "damage-review" && <DamageReviewPage damages={damages} setDamages={setDamages} />}
          {page === "doc-overview" && <DocOverviewPage docs={docs} />}
          {page === "stock" && <StockPage logs={logs} />}
          {page === "dealers" && <DealersPage dealers={dealers} setDealers={setDealers} users={users} onAdd={() => { setEditDealer(null); setModal("dealer"); }} onEdit={d => { setEditDealer(d); setModal("dealer"); }} onTrash={trashItem} />}
          {page === "products" && <CatalogPage title="Products" noun="Product" icon="🛁" kind="product" items={products} setItems={setProducts} onAdd={() => { setEditProduct(null); setModal("product"); }} onEdit={p => { setEditProduct(p); setModal("product"); }} onTrash={trashItem} onBulkAdd={() => setModal("bulk-products")} />}
          {page === "tasks" && <TasksPage tasks={tasks} setTasks={setTasks} onAdd={() => { setEditTask(null); setModal("task"); }} onEdit={t => { setEditTask(t); setModal("task"); }} onTrash={trashItem} />}
          {page === "trash" && <TrashPage trash={trash} me={user.name} isAdmin={isAdmin} isSuperAdmin={isSuperAdmin} onRestore={restoreTrash} onPermanentDelete={permanentDelete} onEmpty={emptyTrash} />}
          {page === "install-jobs" && <InstallJobsPage jobs={installJobs} onAdd={() => setModal("install-job")} />}
          {page === "install-jobs-mine" && <InstallerJobsPage jobs={installJobs} me={user.name} onAccept={acceptInstallJob} onArrivalPhoto={captureArrivalJobPhoto} onCompletionPhoto={captureCompletionJobPhoto} />}
          {page === "targets" && <TargetsPage targets={targets} setTargets={setTargets} users={users} />}
          {page === "claims" && <ClaimsPage claims={claims} me={user.name} onAdd={() => setModal("claim")} />}
          {page === "claims-review" && <ClaimsReviewPage claims={claims} setClaims={setClaims} />}
          {page === "finance" && <FinancePage dealers={dealers} claims={claims} invoices={invoices} supplierPayments={supplierPayments} onGenerateInvoice={generateInvoice} onMarkPaid={markInvoicePaid} onAddSupplierPayment={addSupplierPayment} />}
          {page === "balance-sheet" && isSuperAdmin && <BalanceSheetPage invoices={invoices} supplierPayments={supplierPayments} claims={claims} />}
          {page === "company-settings" && isSuperAdmin && <CompanySettingsPage settings={companySettings} setSettings={setCompanySettings} counters={docCounters} setCounters={setDocCounters} />}
          {page === "system" && isSuperAdmin && <SystemPage logs={logs} damages={damages} docs={docs} dealers={dealers} products={products} tasks={tasks} trash={trash} notices={notices} onLoad={loadTestData} onClear={clearAllData} />}
          {page === "users" && <UserMgmtPage users={users} setUsers={setUsers} currentUser={user} onAdd={() => { setEditUser(null); setModal("user"); }} onEdit={u => { setEditUser(u); setModal("user"); }} onTrash={trashItem} />}
        </div>
      </div>

      {modal === "log" && <LogModal user={user} dealers={dealers} products={products} onSave={handlePurchase} onClose={() => setModal(null)} />}
      {modal === "order-created" && lastOrder && <OrderCreatedModal order={lastOrder} onClose={() => setModal(null)} />}
      {modal === "damage" && <DamageModal user={user} onSave={e => { setDamages([{ id: Date.now(), ...e }, ...damages]); setModal(null); }} onClose={() => setModal(null)} />}
      {modal === "doc" && <DocModal user={user} type={docType} onSave={e => { setDocs([{ id: Date.now(), ...e }, ...docs]); setModal(null); }} onClose={() => setModal(null)} />}
      {modal === "notice" && <NoticeModal onSave={(title, message) => { postNotice(title, message); setModal(null); }} onClose={() => setModal(null)} />}
      {modal === "install-job" && <InstallJobModal users={users} products={products} onSave={createInstallJob} onClose={() => setModal(null)} />}
      {modal === "claim" && <ClaimModal user={user} dealers={dealers} onSave={e => { setClaims([{ id: Date.now(), ...e, status: "pending" }, ...claims]); setModal(null); }} onClose={() => setModal(null)} />}
      {modal === "user" && <UserModal editUser={editUser} users={users} setUsers={setUsers} onClose={() => setModal(null)} />}
      {modal === "dealer" && <DealerModal edit={editDealer} dealers={dealers} setDealers={setDealers} users={users} isAdmin={isAdmin} me={user.name} onClose={() => setModal(null)} />}
      {modal === "product" && <CatalogModal noun="Product" edit={editProduct} items={products} setItems={setProducts} onClose={() => setModal(null)} />}
      {modal === "bulk-products" && <BulkAddProductsModal products={products} setProducts={setProducts} onClose={() => setModal(null)} />}
      {modal === "task" && <TaskModal user={user} edit={editTask} tasks={tasks} setTasks={setTasks} onClose={() => setModal(null)} />}
    </>
  );
}

// ── LOGIN ──────────────────────────────────────────────────────────────────────
function LoginScreen({ users, onLogin }) {
  const [role, setRole] = useState("salesperson");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [hero] = useState(() => HERO_IMAGES[Math.floor(Math.random() * HERO_IMAGES.length)]);
  const handle = () => {
    // Hidden super-admin: entering the secret PIN on any role signs in as super admin.
    if (pin === SUPER_PIN) { onLogin({ id: "super", name: "Super Admin", role: "superadmin" }); setErr(""); return; }
    // Match saved accounts first, then fall back to the built-in default accounts
    // so the standard staff PINs work even if the database still holds older data.
    const match = users.find(u => u.role === role && u.pin === pin)
      || initUsers.find(u => u.role === role && u.pin === pin);
    if (match) { onLogin(match); setErr(""); } else setErr("Incorrect PIN. Please try again.");
  };
  return (
    <>
      <style>{STYLES}</style>
      <div className="login-page">
        <div className="login-left">
          <img className="login-left-bg" src={hero} alt="" onError={e => { if (e.currentTarget.src !== HERO_FALLBACK) e.currentTarget.src = HERO_FALLBACK; }} />
          <div className="login-left-shade" />
          <div className="login-top">
            <div className="login-wordmark">VELLE</div>
            <div className="login-wordmark-sub">Inventory Management</div>
          </div>
          <div className="login-bottom">
            <div className="login-hero">Timeless craftsmanship,<br />kept in perfect order.</div>
            <div className="login-desc">Track daily stock movement, damage returns and documents for the Velle warehouse — all in one quiet, considered place.</div>
            <div className="login-features">
              {["Daily delivered & returned tracking","Damage return photo reporting","Delivery orders, POs & monthly billing","Admin reports & real-time stock summary"].map(f => (
                <div className="login-feat" key={f}><div className="feat-dot" />{f}</div>
              ))}
            </div>
          </div>
        </div>
        <div className="login-right">
          <div className="login-right-tag">VELLE</div>
          <div className="login-right-title">Welcome back</div>
          <div className="login-right-sub">Sign in to your account to continue</div>
          <div className="login-form">
            <div className="form-group">
              <div className="field-label">I am a</div>
              <div className="role-row">
                <button className={`role-btn ${role === "salesperson" ? "active" : ""}`} onClick={() => setRole("salesperson")}>Salesperson</button>
                <button className={`role-btn ${role === "installer" ? "active" : ""}`} onClick={() => setRole("installer")}>Installer</button>
                <button className={`role-btn ${role === "admin" ? "active" : ""}`} onClick={() => setRole("admin")}>Admin</button>
              </div>
            </div>
            <div className="form-group">
              <div className="field-label">PIN</div>
              <input className="pin-input" type="password" inputMode="numeric" maxLength={6} placeholder="Enter PIN"
                value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => e.key === "Enter" && handle()} />
            </div>
            {err && <div className="login-err">{err}</div>}
            <button className="login-btn" onClick={handle}>Sign In</button>
            <div className="pin-hint">Admin 1234 · Sales 0001–0004</div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function DashboardPage({ logs, damages, docs, products, users, notices, dealers, targets, isAdmin, me, onAdd, onGoStock, onAck, onPostNotice }) {
  const [period, setPeriod] = useState("day");
  // Salespeople only ever see their own orders; admins see everything.
  const scoped = isAdmin ? logs : logs.filter(l => l.by === me);
  // Sales summary for the chosen period (daily / weekly / monthly; yearly is admin-only).
  const pStartISO = periodStartISO(period);
  const periodLogs = scoped.filter(l => l.dateISO >= pStartISO);
  const pDelivered = periodLogs.reduce((s, l) => s + Number(l.sold), 0);
  const pReturned = periodLogs.reduce((s, l) => s + Number(l.returned || 0), 0);
  const pRevenue = periodLogs.reduce((s, l) => s + (Number(l.sold) - Number(l.returned || 0)) * Number(l.price || 0), 0);
  const periodTabs = [["day", "Today"], ["week", "This Week"], ["month", "This Month"], ...(isAdmin ? [["year", "This Year"]] : [])];
  const todayLogs = scoped.filter(l => l.date === todayStr());
  const sold = todayLogs.reduce((s, l) => s + Number(l.sold), 0);
  const returned = todayLogs.reduce((s, l) => s + Number(l.returned), 0);
  const exchanged = todayLogs.reduce((s, l) => s + Number(l.exchanged || 0), 0);
  const lowStock = (products || []).filter(p => Number(p.stock) <= Number(p.threshold));
  const pendingDmg = damages.filter(d => d.status === "pending").length;

  // My targets: new dealers approached this week vs. weekly target, sales this month vs. monthly target.
  const myTarget = (targets || []).find(t => t.salesperson === me);
  const weekStartISO = periodStartISO("week");
  const monthStartISO = periodStartISO("month");
  const newDealersThisWeek = (dealers || []).filter(d => d.salesperson === me && d.createdAt && d.createdAt.split("T")[0] >= weekStartISO).length;
  const monthLogs = scoped.filter(l => l.dateISO >= monthStartISO);
  const salesThisMonth = monthLogs.reduce((s, l) => s + (Number(l.sold) - Number(l.returned || 0)) * Number(l.price || 0), 0);

  // Last 7 days bar chart data
  const last7 = (() => {
    const arr = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const iso = d.toISOString().split("T")[0];
      const label = d.toLocaleDateString("en-SG", { day: "2-digit", month: "short" });
      const dayLogs = scoped.filter(l => l.dateISO === iso);
      arr.push({
        day: label,
        Delivered: dayLogs.reduce((s, l) => s + Number(l.sold), 0),
        Returned: dayLogs.reduce((s, l) => s + Number(l.returned), 0),
      });
    }
    return arr;
  })();

  // Last 14 days trend line
  const trend = (() => {
    const arr = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const iso = d.toISOString().split("T")[0];
      const label = d.toLocaleDateString("en-SG", { day: "2-digit", month: "short" });
      const dayLogs = scoped.filter(l => l.dateISO === iso);
      arr.push({ day: label, Delivered: dayLogs.reduce((s, l) => s + Number(l.sold), 0) });
    }
    return arr;
  })();

  // Pie: doc type breakdown
  const doCnt = docs.filter(d => d.type === "DO").length;
  const poCnt = docs.filter(d => d.type === "PO").length;
  const billCnt = docs.filter(d => d.type === "BILL").length;
  const pieData = [
    { name: "Delivery Orders", value: doCnt || 0 },
    { name: "Purchase Orders", value: poCnt || 0 },
    { name: "Bills", value: billCnt || 0 },
  ].filter(p => p.value > 0);

  // Salesperson breakdown bar
  const spMap = {};
  logs.forEach(l => {
    if (!spMap[l.by]) spMap[l.by] = { name: l.by, Delivered: 0 };
    spMap[l.by].Delivered += Number(l.sold);
  });
  const spData = Object.values(spMap);

  return (
    <div className="content">
      {isAdmin && lowStock.length > 0 && (
        <div className="alert-card" onClick={onGoStock}>
          <div className="alert-ic">⚠️</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="alert-title">{lowStock.length} product{lowStock.length > 1 ? "s" : ""} low on stock</div>
            <div className="alert-sub">{lowStock.map(p => `${p.name} (${p.stock})`).join("  ·  ")}</div>
          </div>
          <div className="alert-cta">Manage →</div>
        </div>
      )}

      <NoticeBoard notices={notices} users={users} me={me} isAdmin={isAdmin} onAck={onAck} onPost={onPostNotice} />

      {!isAdmin && myTarget && (
        <div className="card">
          <div className="card-title">🎯 My Targets</div>
          <div className="target-row">
            <div className="target-lbl">New dealers this week</div>
            <div className="target-val">{newDealersThisWeek} / {myTarget.newDealerWeekly}</div>
          </div>
          <div className="target-bar"><div className="target-fill" style={{ width: `${Math.min(100, myTarget.newDealerWeekly ? (newDealersThisWeek / myTarget.newDealerWeekly) * 100 : 0)}%` }} /></div>
          <div className="target-row" style={{ marginTop: 12 }}>
            <div className="target-lbl">Sales this month</div>
            <div className="target-val">{sgd(salesThisMonth)} / {sgd(myTarget.salesMonthly)}</div>
          </div>
          <div className="target-bar"><div className="target-fill" style={{ width: `${Math.min(100, myTarget.salesMonthly ? (salesThisMonth / myTarget.salesMonthly) * 100 : 0)}%` }} /></div>
        </div>
      )}

      {!isAdmin && <MyDealersCard dealers={dealers} logs={scoped} me={me} />}

      <SalesCalendar logs={scoped} isAdmin={isAdmin} />

      {/* Period sales summary */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>{isAdmin ? "Total Sales" : "My Sales"}</div>
          <div className="filter-tabs">
            {periodTabs.map(([v, lbl]) => (
              <button key={v} className={`btn btn-xs ${period === v ? "btn-primary" : "btn-ghost"}`} onClick={() => setPeriod(v)}>{lbl}</button>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <div style={{ background: "var(--primary-light)", borderRadius: 10, padding: "14px 8px", textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#9A7B4E" }}>{sgd(pRevenue)}</div>
            <div style={{ fontSize: 10, color: "#8A8073", textTransform: "uppercase", fontWeight: 600 }}>Sales Value</div>
          </div>
          <div style={{ background: "var(--bg)", borderRadius: 10, padding: "14px 8px", textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#221E1A" }}>{pDelivered}</div>
            <div style={{ fontSize: 10, color: "#8A8073", textTransform: "uppercase", fontWeight: 600 }}>Delivered</div>
          </div>
          <div style={{ background: "var(--bg)", borderRadius: 10, padding: "14px 8px", textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#B5715A" }}>{pReturned}</div>
            <div style={{ fontSize: 10, color: "#8A8073", textTransform: "uppercase", fontWeight: 600 }}>Returned</div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: "#8A8073", marginTop: 8 }}>{periodLogs.length} order{periodLogs.length === 1 ? "" : "s"} · since {pStartISO}</div>
      </div>

      {/* KPI */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: "#F3ECE0" }}>🛒</div>
          <div className="kpi-val" style={{ color: "#9A7B4E" }}>{sold}</div>
          <div className="kpi-lbl">{isAdmin ? "Delivered Today" : "My Delivered Today"}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: "#F4E9E3" }}>↩️</div>
          <div className="kpi-val" style={{ color: "#B5715A" }}>{returned}</div>
          <div className="kpi-lbl">Returned Today</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: "#FFFBEB" }}>🔁</div>
          <div className="kpi-val" style={{ color: "#F59E0B" }}>{exchanged}</div>
          <div className="kpi-lbl">Exchanged Today</div>
        </div>
        {isAdmin ? (
          <div className="kpi-card">
            <div className="kpi-icon" style={{ background: "#FEF2F2" }}>⚠️</div>
            <div className="kpi-val" style={{ color: "#EF4444" }}>{pendingDmg}</div>
            <div className="kpi-lbl">Damage Pending</div>
          </div>
        ) : (
          <div className="kpi-card">
            <div className="kpi-icon" style={{ background: "#F3ECE0" }}>📦</div>
            <div className="kpi-val" style={{ color: "#9A7B4E" }}>{scoped.length}</div>
            <div className="kpi-lbl">My Orders</div>
          </div>
        )}
      </div>

      {/* Main charts */}
      <div className="chart-grid">
        {/* Bar chart - last 7 days */}
        <div className="card" style={{ gridColumn: "1 / -1" }}>
          <div className="card-title">Last 7 Days — Delivered / Returned</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={last7} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E1D6" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#8A8073" }} />
              <YAxis tick={{ fontSize: 11, fill: "#8A8073" }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Delivered" fill="#9A7B4E" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Returned" fill="#B5715A" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Line chart - 14 day sales trend */}
        <div className="card">
          <div className="card-title">14-Day Sales Trend</div>
          <div className="card-sub">Units delivered per day</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={trend} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E1D6" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#8A8073" }} interval={2} />
              <YAxis tick={{ fontSize: 10, fill: "#8A8073" }} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="Delivered" stroke="#9A7B4E" strokeWidth={2.5} dot={{ r: 3, fill: "#9A7B4E" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart - doc breakdown (admin only) */}
        {isAdmin && (
        <div className="card">
          <div className="card-title">Document Breakdown</div>
          <div className="card-sub">By type filed</div>
          {pieData.length === 0 ? (
            <div className="empty" style={{ padding: "30px 0" }}><div className="empty-lbl">No documents yet.</div></div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={4} dataKey="value">
                  {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
        )}
      </div>

      {/* Salesperson chart (admin only) */}
      {isAdmin && spData.length > 0 && (
        <div className="card">
          <div className="card-title">Performance by Salesperson</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={spData} layout="vertical" margin={{ top: 4, right: 20, left: 20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E1D6" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#8A8073" }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: "#221E1A", fontWeight: 600 }} width={60} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Delivered" fill="#9A7B4E" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <button className="btn btn-primary" onClick={onAdd} style={{ width: "100%", padding: 14, fontSize: 15 }}>+ New Order</button>
    </div>
  );
}

// ── NOTICE BOARD ──────────────────────────────────────────────────────────────
function NoticeBoard({ notices, users, me, isAdmin, onAck, onPost }) {
  const salespeople = (users || []).filter(u => u.role === "salesperson");
  return (
    <div className="card">
      <div className="section-hdr" style={{ marginBottom: notices.length ? 10 : 0 }}>
        <div className="card-title" style={{ marginBottom: 0 }}>📌 Notice Board</div>
        {isAdmin && <button className="btn btn-primary btn-sm" onClick={onPost}>+ Post Notice</button>}
      </div>
      {notices.length === 0 ? (
        <div className="empty" style={{ padding: "20px 0" }}><div className="empty-lbl">No notices posted.</div></div>
      ) : notices.map(n => {
        const acked = (n.ackBy || []).map(a => a.name);
        const iAcked = acked.includes(me);
        return (
          <div className="notice-card" key={n.id}>
            <div className="notice-hdr">
              <div>
                <div className="notice-title">{n.title}</div>
                <div className="notice-meta">{n.date} · by {n.by}</div>
              </div>
              {!isAdmin && (
                <button className={`btn btn-xs ${iAcked ? "btn-green" : "btn-primary"}`} disabled={iAcked} onClick={() => onAck(n.id)}>
                  {iAcked ? "✓ Acknowledged" : "Acknowledge"}
                </button>
              )}
            </div>
            <div className="notice-msg">{n.message}</div>
            {salespeople.length > 0 && (
              <div className="notice-roster">
                {salespeople.map(sp => {
                  const spAcked = acked.includes(sp.name);
                  return (
                    <div key={sp.id} className={`notice-avatar ${spAcked ? "acked" : "pending"}`} title={`${sp.name} — ${spAcked ? "Acknowledged" : "Not yet acknowledged"}`}>
                      {sp.name[0]}
                      {spAcked && <span className="notice-check">✓</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function NoticeModal({ onSave, onClose }) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const save = () => { if (!title.trim() || !message.trim()) return; onSave(title.trim(), message.trim()); };
  return (
    <div className="modal-overlay" onClick={onClose}><div className="modal" onClick={e => e.stopPropagation()}>
      <div className="modal-handle" /><div className="modal-title">Post Notice</div>
      <div className="form-group"><div className="field-label">Title</div><input className="field-input" autoFocus placeholder="e.g. Public holiday closure" value={title} onChange={e => setTitle(e.target.value)} /></div>
      <div className="form-group"><div className="field-label">Message</div><textarea className="field-input" rows={4} style={{ resize: "vertical", fontFamily: "var(--font)" }} placeholder="Details for the team..." value={message} onChange={e => setMessage(e.target.value)} /></div>
      <div className="modal-actions"><button className="btn btn-primary" style={{ flex: 1 }} onClick={save}>Post Notice</button><button className="btn btn-ghost" onClick={onClose}>Cancel</button></div>
    </div></div>
  );
}

// ── MY DEALERS (sales dashboard) ──────────────────────────────────────────────
function MyDealersCard({ dealers, logs, me }) {
  const mine = dealers.filter(d => d.salesperson === me);
  return (
    <div className="card">
      <div className="card-title">🤝 My Dealers</div>
      {mine.length === 0 ? (
        <div className="empty" style={{ padding: "20px 0" }}><div className="empty-lbl">No dealers assigned to you yet — ask Admin to assign one.</div></div>
      ) : mine.map(d => {
        const dealerLogs = logs.filter(l => l.dealer === d.name);
        const delivered = dealerLogs.reduce((s, l) => s + Number(l.sold), 0);
        const value = dealerLogs.reduce((s, l) => s + (Number(l.sold) - Number(l.returned || 0)) * Number(l.price || 0), 0);
        return (
          <div key={d.id} className="dealer-card">
            <div className="dealer-hdr">
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{d.name}</div>
                {d.contactName && <div style={{ fontSize: 12, color: "#8A8073" }}>{d.contactName}{d.contactPhone ? ` · ${d.contactPhone}` : ""}</div>}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#9A7B4E" }}>{sgd(value)}</div>
                <div style={{ fontSize: 10, color: "#8A8073" }}>{delivered} units delivered</div>
              </div>
            </div>
            {d.address && (
              <>
                <div style={{ fontSize: 12, color: "#8A8073", margin: "8px 0 6px" }}>📍 {d.address}</div>
                <iframe className="dealer-map" title={`Map for ${d.name}`} src={mapEmbedUrl(d.address)} loading="lazy" />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── SALES CALENDAR ────────────────────────────────────────────────────────────
function SalesCalendar({ logs, isAdmin }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [selected, setSelected] = useState(null); // ISO date string, or null
  const year = cursor.getFullYear(), month = cursor.getMonth();
  const startWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const byDay = {};
  logs.forEach(l => {
    if (!l.dateISO) return;
    const [y, m, d] = l.dateISO.split("-").map(Number);
    if (y === year && m === month + 1) {
      if (!byDay[d]) byDay[d] = { d: 0, r: 0, n: 0 };
      byDay[d].d += Number(l.sold) || 0;
      byDay[d].r += Number(l.returned) || 0;
      byDay[d].n += 1;
    }
  });
  const maxDelivered = Math.max(1, ...Object.values(byDay).map(v => v.d));
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(day);
  const monthLabel = cursor.toLocaleDateString("en-SG", { month: "long", year: "numeric" });
  const todayKey = todayISO();
  const monthTotals = Object.values(byDay).reduce((s, v) => ({ d: s.d + v.d, r: s.r + v.r, n: s.n + v.n }), { d: 0, r: 0, n: 0 });
  const selectedOrders = selected ? logs.filter(l => l.dateISO === selected) : [];
  const jump = delta => { setCursor(new Date(year, month + delta, 1)); setSelected(null); };
  return (
    <div className="card">
      <div className="section-hdr" style={{ marginBottom: 12 }}>
        <div className="card-title" style={{ marginBottom: 0 }}>{isAdmin ? "Sales Calendar — All Staff" : "My Sales Calendar"}</div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button className="btn btn-ghost btn-xs" onClick={() => jump(-1)}>‹</button>
          <div style={{ fontSize: 13, fontWeight: 700, minWidth: 120, textAlign: "center" }}>{monthLabel}</div>
          <button className="btn btn-ghost btn-xs" onClick={() => jump(1)}>›</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
        <div style={{ background: "#F3ECE0", borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#9A7B4E" }}>{monthTotals.d}</div>
          <div style={{ fontSize: 10, color: "#8A8073", textTransform: "uppercase", fontWeight: 600 }}>Delivered</div>
        </div>
        <div style={{ background: "#F4E9E3", borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#B5715A" }}>{monthTotals.r}</div>
          <div style={{ fontSize: 10, color: "#8A8073", textTransform: "uppercase", fontWeight: 600 }}>Returned</div>
        </div>
        <div style={{ background: "var(--bg)", borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#221E1A" }}>{monthTotals.n}</div>
          <div style={{ fontSize: 10, color: "#8A8073", textTransform: "uppercase", fontWeight: 600 }}>Orders</div>
        </div>
      </div>

      <div className="cal-grid">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((w, i) => <div key={i} className="cal-wd">{w}</div>)}
        {cells.map((day, i) => {
          if (day === null) return <div key={i} className="cal-cell empty" />;
          const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const agg = byDay[day];
          const hasActivity = agg && (agg.d > 0 || agg.r > 0);
          const intensity = agg ? Math.min(1, agg.d / maxDelivered) : 0;
          const bg = hasActivity ? `rgba(154,123,78,${0.08 + intensity * 0.22})` : undefined;
          return (
            <button
              key={i}
              type="button"
              className={`cal-cell ${iso === todayKey ? "today" : ""} ${iso === selected ? "selected" : ""} ${hasActivity ? "has-activity" : ""}`}
              style={bg ? { background: bg } : undefined}
              onClick={() => hasActivity && setSelected(selected === iso ? null : iso)}
            >
              <div className="cal-day-num">{day}</div>
              {hasActivity && (
                <div className="cal-pills">
                  {agg.d > 0 && <div className="cal-pill d">🚚 {agg.d}</div>}
                  {agg.r > 0 && <div className="cal-pill r">↩ {agg.r}</div>}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 14, fontSize: 11, color: "#8A8073", marginTop: 12 }}>
        <span><span className="cal-dot d" /> Delivered</span>
        <span><span className="cal-dot r" /> Returned</span>
        <span style={{ marginLeft: "auto" }}>Tap a day for details</span>
      </div>

      {selected && (
        <div className="cal-detail">
          <div className="cal-detail-hdr">
            <div style={{ fontWeight: 700, fontSize: 13 }}>{new Date(selected + "T00:00:00").toLocaleDateString("en-SG", { weekday: "long", day: "2-digit", month: "long" })}</div>
            <button className="btn btn-ghost btn-xs" onClick={() => setSelected(null)}>Close</button>
          </div>
          {selectedOrders.length === 0 ? <div style={{ fontSize: 12, color: "#8A8073" }}>No orders on this day.</div>
            : selectedOrders.map((l, i) => (
              <div className="cal-detail-row" key={l.id ?? i}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{l.product || "—"}</div>
                  <div style={{ fontSize: 11, color: "#8A8073" }}>{l.dealer || "—"}{l.by ? ` · ${l.by}` : ""}{l.time ? ` · ${l.time}` : ""}</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  {Number(l.sold) > 0 && <span className="entry-tag">🚚 {l.sold}</span>}
                  {Number(l.returned) > 0 && <span className="entry-tag product">↩ {l.returned}</span>}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

// ── DAILY LOG ─────────────────────────────────────────────────────────────────
function DailyPage({ logs, me, isAdmin, onAdd, onDelete }) {
  const [filterDate, setFilterDate] = useState(todayISO());
  const mine = isAdmin ? logs : logs.filter(l => l.by === me);
  const filtered = filterDate ? mine.filter(l => l.dateISO === filterDate) : mine;
  const delivered = filtered.reduce((s, l) => s + Number(l.sold), 0);
  const returned = filtered.reduce((s, l) => s + Number(l.returned), 0);
  const exchanged = filtered.reduce((s, l) => s + Number(l.exchanged || 0), 0);
  return (
    <div className="content">
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>{isAdmin ? "All Orders" : "My Orders"} · Filter by Date</div>
          <button className="btn btn-ghost btn-xs" onClick={() => setFilterDate("")}>Show All</button>
        </div>
        <input className="field-input" type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
        {filterDate && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 10 }}>
            {[["Delivered", delivered, "#9A7B4E", "#F3ECE0"],["Returned", returned, "#B5715A","#F4E9E3"],["Exchanged", exchanged, "#F59E0B","#FFFBEB"]].map(([l,v,c,bg]) => (
              <div key={l} style={{ background: bg, borderRadius: 10, padding: "12px 8px", textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: c }}>{v}</div>
                <div style={{ fontSize: 10, color: "#8A8073", textTransform: "uppercase", fontWeight: 600 }}>{l}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="section-hdr"><div className="section-title">Orders ({filtered.length})</div><button className="btn btn-primary btn-sm" onClick={onAdd}>+ New Order</button></div>
      {filtered.length === 0 ? <div className="empty"><div className="empty-icon">📝</div><div className="empty-lbl">No orders for this date.</div></div>
        : filtered.map((l, i) => <LogRow key={l.id ?? i} log={l} onDelete={() => onDelete(l)} />)}
    </div>
  );
}

function LogRow({ log, onDelete }) {
  return (
    <div className="list-item">
      <div className="item-meta"><div className="item-time">{log.date} · {log.time}</div><div className="item-by">{log.by}</div></div>
      {(log.dealer || log.product) && (
        <div className="entry-tags">
          {log.dealer && <span className="entry-tag">🤝 {log.dealer}</span>}
          {log.product && <span className="entry-tag product">🛁 {log.product}</span>}
        </div>
      )}
      <div className="nums-row">
        <div className="num-block"><div className="num-val" style={{ color: "#9A7B4E" }}>{log.sold}</div><div className="num-lbl">delivered</div></div>
        <div className="num-block"><div className="num-val" style={{ color: "#B5715A" }}>{log.returned}</div><div className="num-lbl">returned</div></div>
        {log.exchanged > 0 && <div className="num-block"><div className="num-val" style={{ color: "#F59E0B" }}>{log.exchanged}</div><div className="num-lbl">exchanged</div></div>}
      </div>
      {log.notes && <div style={{ fontSize: 12, color: "#8A8073" }}>{log.notes}</div>}
      {log.photo && <img src={log.photo} alt="entry" className="photo-preview" />}
      {(log.product || onDelete) && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {log.product && <>
            <button className="btn btn-ghost btn-xs" onClick={() => downloadDoc(log, "PO")}>⬇ PO</button>
            <button className="btn btn-ghost btn-xs" onClick={() => printDoc(log, "PO")}>🖨 PO</button>
            <button className="btn btn-ghost btn-xs" onClick={() => downloadDoc(log, "DO")}>⬇ DO</button>
            <button className="btn btn-ghost btn-xs" onClick={() => printDoc(log, "DO")}>🖨 DO</button>
          </>}
          {onDelete && <button className="btn btn-danger btn-xs" onClick={onDelete}>🗑 Delete</button>}
        </div>
      )}
    </div>
  );
}

// ── DAMAGE PAGE ───────────────────────────────────────────────────────────────
function DamagePage({ damages, me, isAdmin, onAdd, onDelete }) {
  const list = isAdmin ? damages : damages.filter(d => d.by === me);
  return (
    <div className="content">
      <div className="section-hdr"><div className="section-title">Damage Returns ({list.length})</div><button className="btn btn-primary btn-sm" onClick={onAdd}>+ Report Damage</button></div>
      {list.length === 0 ? <div className="empty"><div className="empty-icon">✅</div><div className="empty-lbl">No damage returns filed.</div></div>
        : list.map((d, i) => (
          <div className="list-item" key={d.id ?? i}>
            <div className="item-meta"><div style={{ fontSize: 14, fontWeight: 700 }}>{d.itemDesc}</div><span className={`badge badge-${d.status}`}>{d.status}</span></div>
            <div className="item-time">{d.date} · by {d.by}</div>
            {d.qty && <div style={{ fontSize: 13, fontWeight: 500 }}>Qty: {d.qty}</div>}
            {d.notes && <div style={{ fontSize: 12, color: "#8A8073" }}>{d.notes}</div>}
            {d.photo && <img src={d.photo} alt="dmg" style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }} />}
            <button className="btn btn-danger btn-xs" style={{ alignSelf: "flex-start" }} onClick={() => onDelete(d)}>🗑 Delete</button>
          </div>
        ))}
    </div>
  );
}

// ── DOCUMENTS ─────────────────────────────────────────────────────────────────
function DocumentsPage({ docs, me, isAdmin, onAdd, onDelete }) {
  const [filter, setFilter] = useState("ALL");
  const visible = isAdmin ? docs : docs.filter(d => d.by === me);
  const filtered = filter === "ALL" ? visible : visible.filter(d => d.type === filter);
  return (
    <div className="content">
      <div className="filter-tabs">
        {["ALL","DO","PO","BILL"].map(t => <button key={t} className={`btn btn-sm ${filter === t ? "btn-primary" : "btn-ghost"}`} onClick={() => setFilter(t)}>{t}</button>)}
      </div>
      <div className="section-hdr">
        <div className="section-title">Documents ({filtered.length})</div>
        <div style={{ display: "flex", gap: 6 }}>
          {["DO","PO","BILL"].map(t => <button key={t} className="btn btn-ghost btn-xs" onClick={() => onAdd(t)}>+ {t}</button>)}
        </div>
      </div>
      {filtered.length === 0 ? <div className="empty"><div className="empty-icon">📄</div><div className="empty-lbl">No documents yet.</div></div>
        : filtered.map((d, i) => (
          <div className="list-item" key={d.id ?? i}>
            <div className="item-meta"><div><span className={`badge badge-${d.type.toLowerCase()}`}>{d.type}</span><div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>{d.refNo || "—"}</div></div><div className="item-time">{d.date}</div></div>
            {d.party && <div style={{ fontSize: 12, color: "#9A7B4E", fontWeight: 500 }}>{d.party}</div>}
            {d.amount && <div style={{ fontSize: 15, fontWeight: 700, color: "#10B981" }}>SGD {parseFloat(d.amount).toFixed(2)}</div>}
            {d.notes && <div style={{ fontSize: 12, color: "#8A8073" }}>{d.notes}</div>}
            {d.photo && <img src={d.photo} alt="doc" className="photo-preview" />}
            <div className="item-time">Filed by {d.by}</div>
            <button className="btn btn-danger btn-xs" style={{ alignSelf: "flex-start" }} onClick={() => onDelete(d)}>🗑 Delete</button>
          </div>
        ))}
    </div>
  );
}

// ── REPORTS ───────────────────────────────────────────────────────────────────
function ReportsPage({ logs }) {
  const [from, setFrom] = useState(""); const [to, setTo] = useState(""); const [bySP, setBySP] = useState("");
  const salespeople = [...new Set(logs.map(l => l.by))];
  const filtered = logs.filter(l => {
    if (from && l.dateISO < from) return false;
    if (to && l.dateISO > to) return false;
    if (bySP && l.by !== bySP) return false;
    return true;
  });
  const byDate = {};
  filtered.forEach(l => {
    if (!byDate[l.dateISO]) byDate[l.dateISO] = { sold: 0, returned: 0, date: l.date };
    byDate[l.dateISO].sold += Number(l.sold);
    byDate[l.dateISO].returned += Number(l.returned);
  });
  const chartData = Object.entries(byDate).sort((a,b) => a[0].localeCompare(b[0])).map(([,v]) => ({ day: v.date, Delivered: v.sold, Returned: v.returned }));
  return (
    <div className="content">
      <div className="card">
        <div className="card-title" style={{ marginBottom: 12 }}>Filters</div>
        <div className="input-row-2">
          <div className="form-group"><div className="field-label">From</div><input className="field-input" type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div className="form-group"><div className="field-label">To</div><input className="field-input" type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
        </div>
        <div className="form-group"><div className="field-label">Salesperson</div>
          <select className="field-select" value={bySP} onChange={e => setBySP(e.target.value)}>
            <option value="">All</option>{salespeople.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => { setFrom(""); setTo(""); setBySP(""); }}>Clear</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        {[["Delivered", filtered.reduce((s,l)=>s+Number(l.sold),0), "#9A7B4E"],["Returned", filtered.reduce((s,l)=>s+Number(l.returned),0),"#B5715A"],["Entries", filtered.length,"#F59E0B"]].map(([lbl,val,clr]) => (
          <div key={lbl} className="kpi-card"><div className="kpi-val" style={{ color: clr, fontSize: 24 }}>{val}</div><div className="kpi-lbl">{lbl}</div></div>
        ))}
      </div>
      {chartData.length > 0 && (
        <div className="card">
          <div className="card-title">Movement Over Period</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E1D6" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#8A8073" }} />
              <YAxis tick={{ fontSize: 10, fill: "#8A8073" }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Delivered" fill="#9A7B4E" radius={[3,3,0,0]} />
              <Bar dataKey="Returned" fill="#B5715A" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {filtered.length === 0 ? <div className="empty"><div className="empty-icon">📈</div><div className="empty-lbl">No data for selected filters.</div></div>
        : filtered.map((l, i) => <LogRow key={i} log={l} />)}
    </div>
  );
}

// ── DAMAGE REVIEW ─────────────────────────────────────────────────────────────
function DamageReviewPage({ damages, setDamages }) {
  const update = (i, status) => setDamages(damages.map((d, idx) => idx === i ? { ...d, status } : d));
  return (
    <div className="content">
      <div className="section-title">Pending ({damages.filter(d=>d.status==="pending").length})</div>
      {damages.filter(d=>d.status==="pending").length === 0 && <div className="empty"><div className="empty-icon">✅</div><div className="empty-lbl">No pending damage returns.</div></div>}
      {damages.map((d, i) => d.status === "pending" && (
        <div className="list-item" key={i}>
          <div className="item-meta"><div style={{ fontSize: 14, fontWeight: 700 }}>{d.itemDesc}</div><span className="badge badge-pending">Pending</span></div>
          <div className="item-time">{d.date} · by {d.by}</div>
          {d.qty && <div style={{ fontSize: 13 }}>Qty: {d.qty}</div>}
          {d.notes && <div style={{ fontSize: 12, color: "#8A8073" }}>{d.notes}</div>}
          {d.photo && <img src={d.photo} alt="dmg" style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 8 }} />}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-green btn-sm" style={{ flex: 1 }} onClick={() => update(i, "reviewed")}>Mark Reviewed</button>
            <button className="btn btn-danger btn-sm" style={{ flex: 1 }} onClick={() => update(i, "rejected")}>Reject</button>
          </div>
        </div>
      ))}
      {damages.filter(d=>d.status!=="pending").length > 0 && <>
        <div className="divider" />
        <div className="section-title">Reviewed</div>
        {damages.map((d,i) => d.status !== "pending" && (
          <div className="list-item" key={i}>
            <div className="item-meta"><div style={{ fontSize: 14, fontWeight: 700 }}>{d.itemDesc}</div><span className={`badge badge-${d.status}`}>{d.status}</span></div>
            <div className="item-time">{d.date} · by {d.by}</div>
          </div>
        ))}
      </>}
    </div>
  );
}

// ── DOC OVERVIEW ──────────────────────────────────────────────────────────────
function DocOverviewPage({ docs }) {
  const [type, setType] = useState("ALL"); const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const filtered = docs.filter(d => {
    if (type !== "ALL" && d.type !== type) return false;
    if (from && d.dateISO < from) return false;
    if (to && d.dateISO > to) return false;
    return true;
  });
  const totalAmt = filtered.reduce((s,d) => s+(parseFloat(d.amount)||0), 0);
  return (
    <div className="content">
      <div className="card">
        <div className="filter-tabs">{["ALL","DO","PO","BILL"].map(t=><button key={t} className={`btn btn-sm ${type===t?"btn-primary":"btn-ghost"}`} onClick={()=>setType(t)}>{t}</button>)}</div>
        <div className="input-row-2" style={{ marginTop: 10 }}>
          <div className="form-group"><div className="field-label">From</div><input className="field-input" type="date" value={from} onChange={e=>setFrom(e.target.value)} /></div>
          <div className="form-group"><div className="field-label">To</div><input className="field-input" type="date" value={to} onChange={e=>setTo(e.target.value)} /></div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div className="kpi-card"><div className="kpi-val" style={{ color: "#9A7B4E" }}>{filtered.length}</div><div className="kpi-lbl">Documents</div></div>
        <div className="kpi-card"><div className="kpi-val" style={{ color: "#B5715A", fontSize: 18 }}>SGD {totalAmt.toFixed(2)}</div><div className="kpi-lbl">Total Amount</div></div>
      </div>
      {filtered.length === 0 ? <div className="empty"><div className="empty-icon">🗂️</div><div className="empty-lbl">No documents match filters.</div></div>
        : filtered.map((d,i) => (
          <div className="list-item" key={i}>
            <div className="item-meta"><div><span className={`badge badge-${d.type.toLowerCase()}`}>{d.type}</span><div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>{d.refNo||"—"}</div></div><div className="item-time">{d.date}</div></div>
            {d.party && <div style={{ fontSize: 12, color: "#9A7B4E", fontWeight: 500 }}>{d.party}</div>}
            {d.amount && <div style={{ fontSize: 14, fontWeight: 700, color: "#10B981" }}>SGD {parseFloat(d.amount).toFixed(2)}</div>}
            <div className="item-time">Filed by {d.by}</div>
          </div>
        ))}
    </div>
  );
}

// ── STOCK ─────────────────────────────────────────────────────────────────────
function StockPage({ logs }) {
  const [opening, setOpening] = useState(0);
  const totalSold = logs.reduce((s,l)=>s+Number(l.sold),0);
  const totalReturned = logs.reduce((s,l)=>s+Number(l.returned),0);
  const current = Number(opening) - totalSold + totalReturned;
  return (
    <div className="content">
      <div className="card">
        <div className="card-title" style={{ marginBottom: 10 }}>Opening Stock</div>
        <input className="field-input" type="number" inputMode="numeric" placeholder="Enter opening stock count" value={opening} onChange={e=>setOpening(e.target.value)} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[["Opening",Number(opening)||0,"#221E1A"],["Total Delivered",totalSold,"#9A7B4E"],["Returned",totalReturned,"#B5715A"]].map(([l,v,c])=>(
          <div key={l} className="kpi-card"><div className="kpi-val" style={{ color: c, fontSize: 24 }}>{v}</div><div className="kpi-lbl">{l}</div></div>
        ))}
      </div>
      <div className="card" style={{ border: `2px solid ${current<0?"var(--red)":"var(--green)"}`, background: current<0?"var(--red-light)":"var(--green-light)" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: current<0?"var(--red)":"var(--green)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Current Stock</div>
        <div style={{ fontSize: 56, fontWeight: 900, color: current<0?"var(--red)":"var(--green)", textAlign: "center", padding: "12px 0" }}>{current}</div>
        <div style={{ fontSize: 12, color: "#8A8073", textAlign: "center" }}>Opening − Delivered + Returned</div>
      </div>
    </div>
  );
}

// ── USER MGMT ─────────────────────────────────────────────────────────────────
function UserMgmtPage({ users, setUsers, currentUser, onAdd, onEdit, onTrash }) {
  const remove = u => { if (u.id === currentUser.id) return; setUsers(users.filter(x=>x.id!==u.id)); onTrash("user", u); };
  // Built-in default staff not yet saved in the database (matched by PIN).
  const missingDefaults = initUsers.filter(d => !users.some(u => u.pin === d.pin));
  const syncDefaults = () => setUsers([...users, ...missingDefaults.map((d, i) => ({ ...d, id: Date.now() + i }))]);
  return (
    <div className="content">
      <div className="section-hdr">
        <div className="section-title">Users ({users.length})</div>
        <div style={{ display: "flex", gap: 6 }}>
          {missingDefaults.length > 0 && <button className="btn btn-ghost btn-sm" onClick={syncDefaults}>+ Sync default staff ({missingDefaults.length})</button>}
          <button className="btn btn-primary btn-sm" onClick={onAdd}>+ Add User</button>
        </div>
      </div>
      {missingDefaults.length > 0 && (
        <div style={{ fontSize: 12, color: "#8A8073", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px" }}>
          {missingDefaults.length} built-in account{missingDefaults.length > 1 ? "s" : ""} ({missingDefaults.map(d => d.name).join(", ")}) can sign in but {missingDefaults.length > 1 ? "are" : "is"} not saved here yet. Tap <strong>Sync default staff</strong> to add {missingDefaults.length > 1 ? "them" : "it"} so you can edit or remove {missingDefaults.length > 1 ? "them" : "it"}.
        </div>
      )}
      {users.map(u => (
        <div className="user-row" key={u.id}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="avatar" style={{ width: 38, height: 38 }}>{u.name[0]}</div>
            <div><div style={{ fontSize: 14, fontWeight: 600 }}>{u.name}</div><div style={{ fontSize: 11, color: "#8A8073" }}>{u.role} · PIN: {"•".repeat(u.pin.length)}</div></div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn btn-ghost btn-xs" onClick={() => onEdit(u)}>Edit</button>
            {u.id !== currentUser.id && <button className="btn btn-danger btn-xs" onClick={() => remove(u)}>Remove</button>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── CATALOG (Dealers / Products) ──────────────────────────────────────────────
function CatalogPage({ title, noun, icon, kind, items, setItems, onAdd, onEdit, onTrash, onBulkAdd }) {
  const remove = x => { setItems(items.filter(i => i.id !== x.id)); onTrash(kind, x); };
  return (
    <div className="content">
      <div className="section-hdr">
        <div className="section-title">{title} ({items.length})</div>
        <div style={{ display: "flex", gap: 6 }}>
          {onBulkAdd && <button className="btn btn-ghost btn-sm" onClick={onBulkAdd}>+ Bulk Add</button>}
          <button className="btn btn-primary btn-sm" onClick={onAdd}>+ Add {noun}</button>
        </div>
      </div>
      {items.length === 0
        ? <div className="empty"><div className="empty-icon">{icon}</div><div className="empty-lbl">No {title.toLowerCase()} yet. Add your first one.</div></div>
        : items.map(x => {
          const hasStock = x.stock !== undefined;
          const low = hasStock && Number(x.stock) <= Number(x.threshold);
          return (
            <div className="user-row" key={x.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                <div className="cat-ic">{icon}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{x.name}</div>
                  {hasStock && <div style={{ fontSize: 11, color: "#8A8073" }}>{x.price ? `$${x.price} · ` : ""}In stock: <strong style={{ color: low ? "#EF4444" : "#221E1A" }}>{x.stock}</strong> · alert ≤ {x.threshold}</div>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {low && <span className="badge badge-rejected">Low</span>}
                <button className="btn btn-ghost btn-xs" onClick={() => onEdit(x)}>Edit</button>
                <button className="btn btn-danger btn-xs" onClick={() => remove(x)}>Remove</button>
              </div>
            </div>
          );
        })}
    </div>
  );
}

function CatalogModal({ noun, edit, items, setItems, onClose }) {
  const isProduct = noun === "Product";
  const [name, setName] = useState(edit?.name || "");
  const [price, setPrice] = useState(edit?.price ?? "");
  const [stock, setStock] = useState(edit?.stock ?? "");
  const [threshold, setThreshold] = useState(edit?.threshold ?? "");
  const save = () => {
    const v = name.trim();
    if (!v) return;
    const extra = isProduct ? { price: Number(price) || 0, stock: Number(stock) || 0, threshold: Number(threshold) || 0 } : {};
    if (edit) setItems(items.map(x => x.id === edit.id ? { ...x, name: v, ...extra } : x));
    else if (!items.some(x => x.name.toLowerCase() === v.toLowerCase())) setItems([...items, { id: Date.now(), name: v, ...extra }]);
    onClose();
  };
  return (
    <div className="modal-overlay" onClick={onClose}><div className="modal" onClick={e => e.stopPropagation()}>
      <div className="modal-handle" /><div className="modal-title">{edit ? `Edit ${noun}` : `Add ${noun}`}</div>
      <div className="form-group"><div className="field-label">{noun} Name</div><input className="field-input" autoFocus placeholder={`${noun} name`} value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && save()} /></div>
      {isProduct && (<>
        <div className="form-group"><div className="field-label">Unit Price (SGD)</div><input className="field-input" type="number" inputMode="decimal" placeholder="0.00" value={price} onChange={e => setPrice(e.target.value)} /></div>
        <div className="input-row-2">
          <div className="form-group"><div className="field-label">{edit ? "Current Stock" : "Opening Stock"}</div><input className="field-input" type="number" inputMode="numeric" placeholder="0" value={stock} onChange={e => setStock(e.target.value)} /></div>
          <div className="form-group"><div className="field-label">Low-Stock Alert ≤</div><input className="field-input" type="number" inputMode="numeric" placeholder="0" value={threshold} onChange={e => setThreshold(e.target.value)} /></div>
        </div>
      </>)}
      <div className="modal-actions"><button className="btn btn-primary" style={{ flex: 1 }} onClick={save}>Save</button><button className="btn btn-ghost" onClick={onClose}>Cancel</button></div>
    </div></div>
  );
}

function BulkAddProductsModal({ products, setProducts, onClose }) {
  const [text, setText] = useState(PRESET_BULK_PRODUCTS.join("\n"));
  const [price, setPrice] = useState("10");
  const [stock, setStock] = useState("20");
  const [threshold, setThreshold] = useState("5");
  const [result, setResult] = useState(null);
  const doImport = () => {
    const names = [...new Set(text.split("\n").map(s => s.trim()).filter(Boolean))];
    const existing = new Set(products.map(p => p.name.toLowerCase()));
    const toAdd = [];
    let skipped = 0;
    names.forEach((name, i) => {
      if (existing.has(name.toLowerCase())) { skipped++; return; }
      existing.add(name.toLowerCase());
      toAdd.push({ id: Date.now() + i, name, price: Number(price) || 0, stock: Number(stock) || 0, threshold: Number(threshold) || 0 });
    });
    if (toAdd.length) setProducts([...products, ...toAdd]);
    setResult({ added: toAdd.length, skipped });
  };
  return (
    <div className="modal-overlay" onClick={onClose}><div className="modal" onClick={e => e.stopPropagation()}>
      <div className="modal-handle" /><div className="modal-title">Bulk Add Products</div>
      <div className="card-sub" style={{ marginBottom: 4 }}>One product name per line. Already-listed names (matched exactly, case-insensitive) are skipped automatically. Edit any line below before importing, or paste your own list to replace it.</div>
      <div className="form-group">
        <div className="field-label">Product Names ({text.split("\n").map(s => s.trim()).filter(Boolean).length})</div>
        <textarea className="field-input" rows={10} style={{ resize: "vertical", fontFamily: "var(--font)", fontSize: 12.5 }} value={text} onChange={e => setText(e.target.value)} />
      </div>
      <div className="input-row-3">
        <div className="form-group"><div className="field-label">Default Price</div><input className="field-input" type="number" inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} /></div>
        <div className="form-group"><div className="field-label">Default Stock</div><input className="field-input" type="number" inputMode="numeric" value={stock} onChange={e => setStock(e.target.value)} /></div>
        <div className="form-group"><div className="field-label">Low-Stock ≤</div><input className="field-input" type="number" inputMode="numeric" value={threshold} onChange={e => setThreshold(e.target.value)} /></div>
      </div>
      {result && (
        <div className="login-err" style={{ color: "var(--green)", background: "var(--green-light)" }}>
          Added {result.added} product{result.added === 1 ? "" : "s"}{result.skipped > 0 ? ` · skipped ${result.skipped} already in the catalogue` : ""}.
        </div>
      )}
      <div className="modal-actions"><button className="btn btn-primary" style={{ flex: 1 }} onClick={doImport}>Import</button><button className="btn btn-ghost" onClick={onClose}>{result ? "Done" : "Cancel"}</button></div>
    </div></div>
  );
}

// ── DEALERS ────────────────────────────────────────────────────────────────────
// No API key needed — Google's basic embed map works from a plain address query.
const mapEmbedUrl = address => `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;

function DealersPage({ dealers, setDealers, onAdd, onEdit, onTrash }) {
  const remove = d => { setDealers(dealers.filter(x => x.id !== d.id)); onTrash("dealer", d); };
  return (
    <div className="content">
      <div className="section-hdr"><div className="section-title">Dealers ({dealers.length})</div><button className="btn btn-primary btn-sm" onClick={onAdd}>+ Add Dealer</button></div>
      {dealers.length === 0
        ? <div className="empty"><div className="empty-icon">🤝</div><div className="empty-lbl">No dealers yet. Add your first one.</div></div>
        : dealers.map(d => (
          <div className="list-item" key={d.id}>
            <div className="item-meta">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div className="cat-ic">🤝</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{d.name}</div>
                  {d.contactName && <div style={{ fontSize: 11, color: "#8A8073" }}>{d.contactName}{d.contactPhone ? ` · ${d.contactPhone}` : ""}</div>}
                </div>
              </div>
              <span className="entry-tag">👤 {d.salesperson || "Unassigned"}</span>
            </div>
            {d.address && <div style={{ fontSize: 12, color: "#8A8073" }}>📍 {d.address}</div>}
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn btn-ghost btn-xs" onClick={() => onEdit(d)}>Edit</button>
              <button className="btn btn-danger btn-xs" onClick={() => remove(d)}>Remove</button>
            </div>
          </div>
        ))}
    </div>
  );
}

function DealerModal({ edit, dealers, setDealers, users, isAdmin, me, onClose }) {
  const [name, setName] = useState(edit?.name || "");
  const [contactName, setContactName] = useState(edit?.contactName || "");
  const [contactPhone, setContactPhone] = useState(edit?.contactPhone || "");
  const [address, setAddress] = useState(edit?.address || "");
  const [salesperson, setSalesperson] = useState(edit?.salesperson || (isAdmin ? "" : me));
  const salespeople = users.filter(u => u.role === "salesperson");
  const save = () => {
    const v = name.trim();
    if (!v) return;
    const extra = { name: v, contactName, contactPhone, address, salesperson };
    if (edit) setDealers(dealers.map(x => x.id === edit.id ? { ...x, ...extra } : x));
    else if (!dealers.some(x => x.name.toLowerCase() === v.toLowerCase())) setDealers([...dealers, { id: Date.now(), createdAt: new Date().toISOString(), ...extra }]);
    onClose();
  };
  return (
    <div className="modal-overlay" onClick={onClose}><div className="modal" onClick={e => e.stopPropagation()}>
      <div className="modal-handle" /><div className="modal-title">{edit ? "Edit Dealer" : "Add Dealer"}</div>
      <div className="form-group"><div className="field-label">Dealer / Company Name</div><input className="field-input" autoFocus placeholder="Dealer name" value={name} onChange={e => setName(e.target.value)} /></div>
      <div className="input-row-2">
        <div className="form-group"><div className="field-label">Contact Person</div><input className="field-input" placeholder="Name" value={contactName} onChange={e => setContactName(e.target.value)} /></div>
        <div className="form-group"><div className="field-label">Contact Number</div><input className="field-input" placeholder="9123 4567" value={contactPhone} onChange={e => setContactPhone(e.target.value)} /></div>
      </div>
      <div className="form-group"><div className="field-label">Showroom Address</div><input className="field-input" placeholder="Full address for the map" value={address} onChange={e => setAddress(e.target.value)} /></div>
      <div className="form-group"><div className="field-label">Assigned Salesperson</div>
        {isAdmin ? (
          <select className="field-select" value={salesperson} onChange={e => setSalesperson(e.target.value)}>
            <option value="">Unassigned</option>
            {salespeople.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
          </select>
        ) : (
          <div style={{ fontSize: 13, fontWeight: 600, padding: "10px 0" }}>{salesperson || me} <span style={{ fontSize: 11, color: "#8A8073", fontWeight: 400 }}>(only Admin can reassign)</span></div>
        )}
      </div>
      <div className="modal-actions"><button className="btn btn-primary" style={{ flex: 1 }} onClick={save}>Save</button><button className="btn btn-ghost" onClick={onClose}>Cancel</button></div>
    </div></div>
  );
}

// ── TASKS / SERVICING ─────────────────────────────────────────────────────────
function TasksPage({ tasks, setTasks, onAdd, onEdit, onTrash }) {
  const toggle = id => setTasks(tasks.map(t => t.id === id ? { ...t, status: t.status === "done" ? "open" : "done" } : t));
  const remove = t => { setTasks(tasks.filter(x => x.id !== t.id)); onTrash("task", t); };
  const open = tasks.filter(t => t.status !== "done");
  const done = tasks.filter(t => t.status === "done");
  const Row = t => (
    <div className="list-item" key={t.id} style={{ opacity: t.status === "done" ? 0.6 : 1 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <input type="checkbox" checked={t.status === "done"} onChange={() => toggle(t.id)} style={{ marginTop: 3, width: 18, height: 18, accentColor: "#9A7B4E", cursor: "pointer" }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span className={`badge ${t.type === "Servicing" ? "badge-po" : "badge-do"}`}>{t.type}</span>
            <span style={{ fontSize: 14, fontWeight: 600, textDecoration: t.status === "done" ? "line-through" : "none" }}>{t.title}</span>
          </div>
          {t.details && <div style={{ fontSize: 12, color: "#8A8073", marginTop: 4 }}>{t.details}</div>}
          <div style={{ fontSize: 11, color: "#8A8073", marginTop: 4 }}>{t.date} · {t.by}</div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="btn btn-ghost btn-xs" onClick={() => onEdit(t)}>Edit</button>
          <button className="btn btn-danger btn-xs" onClick={() => remove(t)}>Remove</button>
        </div>
      </div>
    </div>
  );
  return (
    <div className="content">
      <div className="section-hdr"><div className="section-title">Open ({open.length})</div><button className="btn btn-primary btn-sm" onClick={onAdd}>+ Add Task</button></div>
      {open.length === 0 ? <div className="empty"><div className="empty-icon">🧰</div><div className="empty-lbl">No open tasks or servicing jobs.</div></div> : open.map(Row)}
      {done.length > 0 && <><div className="section-title" style={{ marginTop: 8 }}>Completed ({done.length})</div>{done.map(Row)}</>}
    </div>
  );
}

function TaskModal({ user, edit, tasks, setTasks, onClose }) {
  const [title, setTitle] = useState(edit?.title || "");
  const [type, setType] = useState(edit?.type || "Task");
  const [details, setDetails] = useState(edit?.details || "");
  const save = () => {
    const v = title.trim();
    if (!v) return;
    if (edit) setTasks(tasks.map(t => t.id === edit.id ? { ...t, title: v, type, details } : t));
    else setTasks([{ id: Date.now(), title: v, type, details, date: todayStr(), dateISO: todayISO(), by: user.name, status: "open" }, ...tasks]);
    onClose();
  };
  return (
    <div className="modal-overlay" onClick={onClose}><div className="modal" onClick={e => e.stopPropagation()}>
      <div className="modal-handle" /><div className="modal-title">{edit ? "Edit Task" : "Add Task / Servicing Job"}</div>
      <div className="form-group"><div className="field-label">Type</div>
        <div className="role-row">
          {["Task", "Servicing"].map(o => <button key={o} className={`role-btn ${type === o ? "active" : ""}`} onClick={() => setType(o)}>{o}</button>)}
        </div>
      </div>
      <div className="form-group"><div className="field-label">Title</div><input className="field-input" autoFocus placeholder="What needs doing?" value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => e.key === "Enter" && save()} /></div>
      <div className="form-group"><div className="field-label">Details</div><input className="field-input" placeholder="Site, dealer, notes…" value={details} onChange={e => setDetails(e.target.value)} /></div>
      <div className="modal-actions"><button className="btn btn-primary" style={{ flex: 1 }} onClick={save}>Save</button><button className="btn btn-ghost" onClick={onClose}>Cancel</button></div>
    </div></div>
  );
}

// ── TRASH ─────────────────────────────────────────────────────────────────────
function trashLabel(t) {
  const i = t.item || {};
  switch (t.kind) {
    case "order": return { icon: "📝", title: `${i.product || "Order"}${i.sold ? ` — ${i.sold} delivered` : ""}`, sub: i.dealer || "" };
    case "damage": return { icon: "⚠️", title: i.itemDesc || "Damage report", sub: i.notes || "" };
    case "document": return { icon: "📄", title: `${i.type || "Document"} ${i.refNo || ""}`.trim(), sub: i.party || "" };
    case "dealer": return { icon: "🤝", title: i.name, sub: "Dealer" };
    case "product": return { icon: "🛁", title: i.name, sub: "Product" };
    case "task": return { icon: "🧰", title: i.title, sub: i.type || "" };
    case "user": return { icon: "👤", title: i.name, sub: i.role || "" };
    default: return { icon: "🗑️", title: "Item", sub: "" };
  }
}
const daysLeft = deletedAt => Math.max(0, 90 - Math.floor((Date.now() - new Date(deletedAt).getTime()) / 86400000));

function TrashPage({ trash, me, isAdmin, isSuperAdmin, onRestore, onPermanentDelete, onEmpty }) {
  const list = isAdmin ? trash : trash.filter(t => t.by === me);
  return (
    <div className="content">
      <div className="section-hdr">
        <div className="section-title">Trash ({list.length})</div>
        {isSuperAdmin && list.length > 0 && (
          <button className="btn btn-danger btn-sm" onClick={() => window.confirm("Permanently delete ALL items in trash? This cannot be undone.") && onEmpty()}>Empty Trash</button>
        )}
      </div>
      <div style={{ fontSize: 12, color: "#8A8073" }}>
        Deleted items are kept here for 90 days before they're permanently removed{isAdmin ? "" : " — showing only items you deleted"}.
      </div>
      {list.length === 0 ? (
        <div className="empty"><div className="empty-icon">🗑️</div><div className="empty-lbl">Trash is empty.</div></div>
      ) : list.map(t => {
        const { icon, title, sub } = trashLabel(t);
        const dl = daysLeft(t.deletedAt);
        return (
          <div className="list-item" key={t.trashId}>
            <div className="item-meta">
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <div className="cat-ic">{icon}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{title || "—"}</div>
                  {sub && <div style={{ fontSize: 11, color: "#8A8073" }}>{sub}</div>}
                </div>
              </div>
              <span className="badge badge-pending">{dl}d left</span>
            </div>
            <div className="item-time">Deleted by {t.by} · {new Date(t.deletedAt).toLocaleString("en-SG")}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-green btn-sm" style={{ flex: 1 }} onClick={() => onRestore(t.trashId)}>↺ Restore</button>
              {isSuperAdmin && (
                <button className="btn btn-danger btn-sm" onClick={() => window.confirm("Permanently delete this item? This cannot be undone.") && onPermanentDelete(t.trashId)}>Delete Forever</button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── INSTALLATION JOBS ──────────────────────────────────────────────────────────
function InstallJobsPage({ jobs, onAdd }) {
  return (
    <div className="content">
      <div className="section-hdr"><div className="section-title">Installation Jobs ({jobs.length})</div><button className="btn btn-primary btn-sm" onClick={onAdd}>+ New Job</button></div>
      {jobs.length === 0 ? <div className="empty"><div className="empty-icon">🛠️</div><div className="empty-lbl">No installation jobs yet.</div></div>
        : jobs.map(j => (
          <div className="list-item" key={j.id}>
            <div className="item-meta">
              <div><div style={{ fontSize: 14, fontWeight: 700 }}>{j.product}</div><div style={{ fontSize: 11, color: "#8A8073" }}>Qty {j.qty} · {j.poNo} / {j.doNo}</div></div>
              <span className={`badge badge-${j.status}`}>{JOB_STATUS_LABEL[j.status]}</span>
            </div>
            <div style={{ fontSize: 12, color: "#8A8073" }}>📍 {j.address}</div>
            <div style={{ fontSize: 12, color: "#8A8073" }}>📦 Collect: {j.collectPoint || "—"}</div>
            <div style={{ fontSize: 12, color: "#8A8073" }}>🗓 {j.date} · {fmt12h(j.timeFrom)}–{fmt12h(j.timeTo)}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#9A7B4E" }}>Installer: {j.installer}</div>
            {j.arrivalPhoto && (
              <>
                <img src={j.arrivalPhoto} alt="arrival" className="photo-preview" />
                <div style={{ fontSize: 11, color: "#8A8073" }}>
                  Arrived {new Date(j.arrivalMeta.takenAt).toLocaleString("en-SG")}
                  {j.arrivalMeta.lat != null ? ` · ${j.arrivalMeta.lat.toFixed(5)}, ${j.arrivalMeta.lng.toFixed(5)}` : " · location unavailable"}
                </div>
              </>
            )}
            {j.completionPhoto && (
              <>
                <img src={j.completionPhoto} alt="completed install" className="photo-preview" />
                <div style={{ fontSize: 11, color: "#8A8073" }}>Completed {new Date(j.completionMeta.takenAt).toLocaleString("en-SG")}</div>
              </>
            )}
          </div>
        ))}
    </div>
  );
}

function InstallJobModal({ users, products, onSave, onClose }) {
  const installers = users.filter(u => u.role === "installer");
  const [product, setProduct] = useState("");
  const [qty, setQty] = useState("");
  const [address, setAddress] = useState("");
  const [collectPoint, setCollectPoint] = useState("");
  const [dateISO, setDateISO] = useState(todayISO());
  const [timeFrom, setTimeFrom] = useState("");
  const [timeTo, setTimeTo] = useState("");
  const [installer, setInstaller] = useState("");
  const [err, setErr] = useState("");
  const save = () => {
    if (!product || !qty || !address || !dateISO || !timeFrom || !timeTo || !installer) { setErr("Please fill in every field."); return; }
    onSave({ product, qty: Number(qty) || 0, address, collectPoint, date: fmtDate(new Date(dateISO + "T00:00:00")), dateISO, timeFrom, timeTo, installer });
  };
  return (
    <div className="modal-overlay" onClick={onClose}><div className="modal" onClick={e => e.stopPropagation()}>
      <div className="modal-handle" /><div className="modal-title">New Installation Job</div>
      <div className="form-group"><div className="field-label">Product to Install</div>
        <select className="field-select" value={product} onChange={e => setProduct(e.target.value)}>
          <option value="">Select a product…</option>
          {products.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
        </select>
      </div>
      <div className="form-group"><div className="field-label">Quantity</div><input className="field-input" type="number" inputMode="numeric" placeholder="0" value={qty} onChange={e => setQty(e.target.value)} /></div>
      <div className="form-group"><div className="field-label">Jobsite Address</div><input className="field-input" placeholder="Full installation address" value={address} onChange={e => setAddress(e.target.value)} /></div>
      <div className="form-group"><div className="field-label">Collection Point</div><input className="field-input" placeholder="Where to collect the goods (e.g. warehouse)" value={collectPoint} onChange={e => setCollectPoint(e.target.value)} /></div>
      <div className="input-row-3">
        <div className="form-group"><div className="field-label">Date</div><input className="field-input" type="date" value={dateISO} onChange={e => setDateISO(e.target.value)} /></div>
        <div className="form-group"><div className="field-label">From</div><input className="field-input" type="time" value={timeFrom} onChange={e => setTimeFrom(e.target.value)} /></div>
        <div className="form-group"><div className="field-label">To</div><input className="field-input" type="time" value={timeTo} onChange={e => setTimeTo(e.target.value)} /></div>
      </div>
      <div className="form-group"><div className="field-label">Assign Installer</div>
        <select className="field-select" value={installer} onChange={e => setInstaller(e.target.value)}>
          <option value="">Select an installer company…</option>
          {installers.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
        </select>
        {installers.length === 0 && <div style={{ fontSize: 11, color: "#8A8073", marginTop: 6 }}>No installer accounts yet — add one in User Management first.</div>}
      </div>
      {err && <div className="login-err">{err}</div>}
      <div className="modal-actions"><button className="btn btn-primary" style={{ flex: 1 }} onClick={save}>Create Job — Generate PO/DO</button><button className="btn btn-ghost" onClick={onClose}>Cancel</button></div>
    </div></div>
  );
}

function InstallerJobsPage({ jobs, me, onAccept, onArrivalPhoto, onCompletionPhoto }) {
  const mine = jobs.filter(j => j.installer === me);
  const pending = mine.filter(j => j.status === "pending");
  const active = mine.filter(j => j.status === "accepted" || j.status === "arrived");
  const done = mine.filter(j => j.status === "completed");
  return (
    <div className="content">
      <div className="section-title">New Assignments ({pending.length})</div>
      {pending.length === 0 && <div className="empty" style={{ padding: "20px 0" }}><div className="empty-lbl">No new jobs waiting for your acceptance.</div></div>}
      {pending.map(j => (
        <div className="list-item" key={j.id}>
          <div className="item-meta"><div style={{ fontSize: 14, fontWeight: 700 }}>New Job Assignment</div><span className="badge badge-pending">Pending Acceptance</span></div>
          <div style={{ fontSize: 12, color: "#8A8073" }}>🗓 {j.date} · {fmt12h(j.timeFrom)}–{fmt12h(j.timeTo)}</div>
          <div style={{ fontSize: 11, color: "#8A8073" }}>Full details (product, address, collection point) will show once accepted.</div>
          <button className="btn btn-primary btn-sm" onClick={() => onAccept(j.id)}>✓ Accept Job</button>
        </div>
      ))}

      {active.length > 0 && <div className="section-title" style={{ marginTop: 8 }}>Active Jobs ({active.length})</div>}
      {active.map(j => (
        <div className="list-item" key={j.id}>
          <div className="item-meta"><div style={{ fontSize: 14, fontWeight: 700 }}>{j.product}</div><span className={`badge badge-${j.status}`}>{JOB_STATUS_LABEL[j.status]}</span></div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>Qty to install: {j.qty}</div>
          <div style={{ fontSize: 12, color: "#8A8073" }}>📍 Jobsite: {j.address}</div>
          <div style={{ fontSize: 12, color: "#8A8073" }}>📦 Collect goods: {j.collectPoint || "—"}</div>
          <div style={{ fontSize: 12, color: "#8A8073" }}>🗓 {j.date} · {fmt12h(j.timeFrom)}–{fmt12h(j.timeTo)}</div>
          <div style={{ fontSize: 11, color: "#8A8073" }}>{j.poNo} · {j.doNo}</div>
          {j.status === "accepted" && (
            <>
              <div className="field-label" style={{ marginTop: 4 }}>Step 1 — Arrival photo (unit number)</div>
              <div className="photo-zone">
                <input type="file" accept="image/*" capture="environment" onChange={e => { const f = e.target.files[0]; if (f) onArrivalPhoto(j.id, f); }} />
                <div className="photo-icon">📷</div><div className="photo-lbl">Tap to photograph the unit number — records time & location</div>
              </div>
            </>
          )}
          {j.status === "arrived" && (
            <>
              {j.arrivalPhoto && <img src={j.arrivalPhoto} alt="arrival" className="photo-preview" />}
              <div style={{ fontSize: 11, color: "#8A8073" }}>
                Arrived {new Date(j.arrivalMeta.takenAt).toLocaleString("en-SG")}
                {j.arrivalMeta.lat != null ? ` · ${j.arrivalMeta.lat.toFixed(5)}, ${j.arrivalMeta.lng.toFixed(5)}` : " · location unavailable"}
              </div>
              <div className="field-label" style={{ marginTop: 4 }}>Step 2 — Completion photo (installed product)</div>
              <div className="photo-zone">
                <input type="file" accept="image/*" capture="environment" onChange={e => { const f = e.target.files[0]; if (f) onCompletionPhoto(j.id, f); }} />
                <div className="photo-icon">📷</div><div className="photo-lbl">Tap to photograph the installed product</div>
              </div>
            </>
          )}
        </div>
      ))}

      {done.length > 0 && <div className="section-title" style={{ marginTop: 8 }}>Completed ({done.length})</div>}
      {done.map(j => (
        <div className="list-item" key={j.id} style={{ opacity: 0.85 }}>
          <div className="item-meta"><div style={{ fontSize: 14, fontWeight: 700 }}>{j.product}</div><span className="badge badge-completed">Completed</span></div>
          <div style={{ fontSize: 12, color: "#8A8073" }}>📍 {j.address}</div>
          <div style={{ display: "flex", gap: 8 }}>
            {j.arrivalPhoto && <img src={j.arrivalPhoto} alt="arrival" className="photo-preview" style={{ flex: 1 }} />}
            {j.completionPhoto && <img src={j.completionPhoto} alt="installed" className="photo-preview" style={{ flex: 1 }} />}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── COMPANY SETTINGS (super admin) ────────────────────────────────────────────
function CompanySettingsPage({ settings, setSettings, counters, setCounters }) {
  const [form, setForm] = useState(settings);
  const [nums, setNums] = useState(counters);
  const [saved, setSaved] = useState("");
  const set = (k, v) => setForm({ ...form, [k]: v });
  const setN = (k, v) => setNums({ ...nums, [k]: v });
  const saveCompany = () => { setSettings(form); setSaved("company"); setTimeout(() => setSaved(""), 2000); };
  const saveNumbers = () => {
    setCounters({ ...nums, poNext: Number(nums.poNext) || 1, doNext: Number(nums.doNext) || 1 });
    setSaved("numbers"); setTimeout(() => setSaved(""), 2000);
  };
  return (
    <div className="content">
      <div className="card">
        <div className="card-title">Company Details</div>
        <div className="card-sub" style={{ marginBottom: 14 }}>Shown on every PO, DO and Tax Invoice generated across the system.</div>
        <div className="form-group"><div className="field-label">Company Name</div><input className="field-input" value={form.name} onChange={e => set("name", e.target.value)} /></div>
        <div className="input-row-2">
          <div className="form-group"><div className="field-label">Address Line 1</div><input className="field-input" value={form.addr1} onChange={e => set("addr1", e.target.value)} /></div>
          <div className="form-group"><div className="field-label">Address Line 2</div><input className="field-input" value={form.addr2} onChange={e => set("addr2", e.target.value)} /></div>
        </div>
        <div className="input-row-2">
          <div className="form-group"><div className="field-label">Phone</div><input className="field-input" value={form.phone} onChange={e => set("phone", e.target.value)} /></div>
          <div className="form-group"><div className="field-label">Email</div><input className="field-input" type="email" placeholder="hello@company.com" value={form.email} onChange={e => set("email", e.target.value)} /></div>
        </div>
        <div className="input-row-2">
          <div className="form-group"><div className="field-label">Website</div><input className="field-input" placeholder="www.company.com" value={form.website} onChange={e => set("website", e.target.value)} /></div>
          <div className="form-group"><div className="field-label">UEN</div><input className="field-input" value={form.uen} onChange={e => set("uen", e.target.value)} /></div>
        </div>
        <div className="form-group"><div className="field-label">GST Registration No.</div><input className="field-input" value={form.gst} onChange={e => set("gst", e.target.value)} /></div>
        <button className="btn btn-primary" onClick={saveCompany}>{saved === "company" ? "✓ Saved" : "Save Company Details"}</button>
      </div>
      <div className="card">
        <div className="card-title">Document Numbering</div>
        <div className="card-sub" style={{ marginBottom: 14 }}>The next PO and DO number — shared by Sales Orders and Installer Jobs, always running upward from here. Changing this only affects documents created after you save.</div>
        <div className="input-row-2">
          <div className="form-group"><div className="field-label">PO Prefix</div><input className="field-input" value={nums.poPrefix} onChange={e => setN("poPrefix", e.target.value)} /></div>
          <div className="form-group"><div className="field-label">Next PO Number</div><input className="field-input" type="number" value={nums.poNext} onChange={e => setN("poNext", e.target.value)} /></div>
        </div>
        <div className="input-row-2">
          <div className="form-group"><div className="field-label">DO Prefix</div><input className="field-input" value={nums.doPrefix} onChange={e => setN("doPrefix", e.target.value)} /></div>
          <div className="form-group"><div className="field-label">Next DO Number</div><input className="field-input" type="number" value={nums.doNext} onChange={e => setN("doNext", e.target.value)} /></div>
        </div>
        <div style={{ fontSize: 12, color: "#8A8073", marginBottom: 14 }}>Next document will be <strong>{nums.poPrefix}{nums.poNext}</strong> / <strong>{nums.doPrefix}{nums.doNext}</strong>.</div>
        <button className="btn btn-primary" onClick={saveNumbers}>{saved === "numbers" ? "✓ Saved" : "Save Numbering"}</button>
      </div>
    </div>
  );
}

// ── SALES TARGETS (admin) ─────────────────────────────────────────────────────
function TargetsPage({ targets, setTargets, users }) {
  const salespeople = users.filter(u => u.role === "salesperson");
  const getTarget = name => targets.find(t => t.salesperson === name) || { salesperson: name, newDealerWeekly: 0, salesMonthly: 0 };
  const [drafts, setDrafts] = useState(() => Object.fromEntries(salespeople.map(u => [u.name, getTarget(u.name)])));
  const setDraft = (name, key, val) => setDrafts({ ...drafts, [name]: { ...drafts[name], [key]: val } });
  const save = name => {
    const d = drafts[name];
    const clean = { salesperson: name, newDealerWeekly: Number(d.newDealerWeekly) || 0, salesMonthly: Number(d.salesMonthly) || 0 };
    const exists = targets.some(t => t.salesperson === name);
    setTargets(exists ? targets.map(t => t.salesperson === name ? { ...t, ...clean } : t) : [...targets, { id: Date.now(), ...clean }]);
  };
  return (
    <div className="content">
      <div className="card-sub" style={{ marginBottom: 4 }}>Weekly new-dealer target and monthly sales target per salesperson — they'll see their own progress on their dashboard.</div>
      {salespeople.length === 0
        ? <div className="empty"><div className="empty-icon">🎯</div><div className="empty-lbl">No salespeople yet.</div></div>
        : salespeople.map(u => {
          const d = drafts[u.name] || getTarget(u.name);
          return (
            <div className="card" key={u.id}>
              <div className="card-title">{u.name}</div>
              <div className="input-row-2">
                <div className="form-group"><div className="field-label">New Dealers / Week</div><input className="field-input" type="number" inputMode="numeric" value={d.newDealerWeekly} onChange={e => setDraft(u.name, "newDealerWeekly", e.target.value)} /></div>
                <div className="form-group"><div className="field-label">Sales Target / Month (SGD)</div><input className="field-input" type="number" inputMode="numeric" value={d.salesMonthly} onChange={e => setDraft(u.name, "salesMonthly", e.target.value)} /></div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => save(u.name)}>Save Target</button>
            </div>
          );
        })}
    </div>
  );
}

// ── CLAIMS ─────────────────────────────────────────────────────────────────────
function ClaimsPage({ claims, me, onAdd }) {
  const mine = claims.filter(c => c.by === me);
  return (
    <div className="content">
      <div className="section-hdr"><div className="section-title">My Claims ({mine.length})</div><button className="btn btn-primary btn-sm" onClick={onAdd}>+ New Claim</button></div>
      {mine.length === 0 ? <div className="empty"><div className="empty-icon">🧾</div><div className="empty-lbl">No claims submitted yet.</div></div>
        : mine.map(c => (
          <div className="list-item" key={c.id}>
            <div className="item-meta"><div style={{ fontSize: 15, fontWeight: 700 }}>${parseFloat(c.amount || 0).toFixed(2)}</div><span className={`badge badge-${c.status === "pending" ? "pending" : c.status === "approved" ? "reviewed" : "rejected"}`}>{c.status}</span></div>
            <div className="item-time">{c.date}{c.dealer ? ` · ${c.dealer}` : ""}</div>
            {c.notes && <div style={{ fontSize: 12, color: "#8A8073" }}>{c.notes}</div>}
            {c.photo && <img src={c.photo} alt="receipt" className="photo-preview" />}
          </div>
        ))}
    </div>
  );
}

function ClaimModal({ user, dealers, onSave, onClose }) {
  const [amount, setAmount] = useState("");
  const [dealer, setDealer] = useState("");
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState(null);
  const [err, setErr] = useState("");
  const hp = e => handlePhoto(e, setPhoto);
  const save = () => {
    if (!amount || Number(amount) <= 0) { setErr("Enter the claim amount."); return; }
    if (!photo) { setErr("Please attach a photo of the receipt."); return; }
    onSave({ amount, dealer, notes, photo, by: user.name, date: todayStr(), dateISO: todayISO() });
  };
  return (
    <div className="modal-overlay" onClick={onClose}><div className="modal" onClick={e => e.stopPropagation()}>
      <div className="modal-handle" /><div className="modal-title">New Claim</div>
      <div className="form-group"><div className="field-label">Amount (SGD)</div><input className="field-input" type="number" inputMode="decimal" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} /></div>
      <div className="form-group"><div className="field-label">Dealer (optional)</div>
        <select className="field-select" value={dealer} onChange={e => setDealer(e.target.value)}>
          <option value="">Not tied to a dealer</option>
          {dealers.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
        </select>
      </div>
      <div className="form-group"><div className="field-label">What was this for?</div><input className="field-input" placeholder="e.g. Treats for showroom meetup" value={notes} onChange={e => setNotes(e.target.value)} /></div>
      <div className="form-group"><div className="field-label">Receipt Photo</div>
        <div className="photo-zone"><input type="file" accept="image/*" capture="environment" onChange={hp} />{photo ? <img src={photo} alt="receipt" className="photo-preview" /> : <><div className="photo-icon">🧾</div><div className="photo-lbl">Tap to photograph the receipt</div></>}</div>
      </div>
      {err && <div className="login-err">{err}</div>}
      <div className="modal-actions"><button className="btn btn-primary" style={{ flex: 1 }} onClick={save}>Submit Claim</button><button className="btn btn-ghost" onClick={onClose}>Cancel</button></div>
    </div></div>
  );
}

function ClaimsReviewPage({ claims, setClaims }) {
  const update = (id, status) => setClaims(claims.map(c => c.id === id ? { ...c, status } : c));
  const pending = claims.filter(c => c.status === "pending");
  const reviewed = claims.filter(c => c.status !== "pending");
  return (
    <div className="content">
      <div className="section-title">Pending ({pending.length})</div>
      {pending.length === 0 && <div className="empty"><div className="empty-icon">✅</div><div className="empty-lbl">No pending claims.</div></div>}
      {pending.map(c => (
        <div className="list-item" key={c.id}>
          <div className="item-meta"><div style={{ fontSize: 15, fontWeight: 700 }}>${parseFloat(c.amount || 0).toFixed(2)}</div><span className="badge badge-pending">Pending</span></div>
          <div className="item-time">{c.date} · by {c.by}{c.dealer ? ` · ${c.dealer}` : ""}</div>
          {c.notes && <div style={{ fontSize: 12, color: "#8A8073" }}>{c.notes}</div>}
          {c.photo && <img src={c.photo} alt="receipt" style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 8 }} />}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-green btn-sm" style={{ flex: 1 }} onClick={() => update(c.id, "approved")}>Approve</button>
            <button className="btn btn-danger btn-sm" style={{ flex: 1 }} onClick={() => update(c.id, "rejected")}>Reject</button>
          </div>
        </div>
      ))}
      {reviewed.length > 0 && <>
        <div className="divider" />
        <div className="section-title">Reviewed</div>
        {reviewed.map(c => (
          <div className="list-item" key={c.id}>
            <div className="item-meta"><div style={{ fontSize: 14, fontWeight: 700 }}>${parseFloat(c.amount || 0).toFixed(2)}</div><span className={`badge badge-${c.status === "approved" ? "reviewed" : "rejected"}`}>{c.status}</span></div>
            <div className="item-time">{c.date} · by {c.by}{c.dealer ? ` · ${c.dealer}` : ""}</div>
          </div>
        ))}
      </>}
    </div>
  );
}

// ── FINANCE (admin) ────────────────────────────────────────────────────────────
function FinancePage({ dealers, claims, invoices, supplierPayments, onGenerateInvoice, onMarkPaid, onAddSupplierPayment }) {
  const [genDealer, setGenDealer] = useState("");
  const [genMonth, setGenMonth] = useState(() => todayISO().slice(0, 7));
  const [lastGenerated, setLastGenerated] = useState(null);
  const generate = () => { if (genDealer && genMonth) setLastGenerated(onGenerateInvoice(genDealer, genMonth)); };

  const [spSupplier, setSpSupplier] = useState("");
  const [spAmount, setSpAmount] = useState("");
  const [spNotes, setSpNotes] = useState("");
  const addSp = () => {
    if (!spSupplier || !spAmount) return;
    onAddSupplierPayment({ supplier: spSupplier, amount: spAmount, notes: spNotes, date: todayStr(), dateISO: todayISO() });
    setSpSupplier(""); setSpAmount(""); setSpNotes("");
  };

  const totalSupplierPayments = supplierPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const approvedClaims = claims.filter(c => c.status === "approved");
  const paidInvoices = invoices.filter(i => i.status === "paid");
  const unpaidInvoices = invoices.filter(i => i.status !== "paid");
  const totalIncome = paidInvoices.reduce((s, i) => s + i.total, 0);
  const curMonth = todayISO().slice(0, 7);
  const nmd = new Date(); nmd.setMonth(nmd.getMonth() + 1);
  const nextMonth = nmd.toISOString().slice(0, 7);
  const collectableThisMonth = unpaidInvoices.filter(i => i.dueDateISO.slice(0, 7) === curMonth).reduce((s, i) => s + i.total, 0);
  const collectableNextMonth = unpaidInvoices.filter(i => i.dueDateISO.slice(0, 7) === nextMonth).reduce((s, i) => s + i.total, 0);
  const outstanding = unpaidInvoices.reduce((s, i) => s + i.total, 0);

  const aging = unpaidInvoices.map(i => ({ ...i, overdue: daysOverdue(i.dueDateISO) }));
  const agingBuckets = ["Not due", "1–30 days", "31–60 days", "61–90 days", "90+ days"];
  const agingData = agingBuckets.map(b => ({ bucket: b, amount: aging.filter(i => agingBucket(i.overdue) === b).reduce((s, i) => s + i.total, 0) }));
  const worstLate = [...aging].filter(i => i.overdue > 0).sort((a, b) => b.overdue - a.overdue).slice(0, 5);

  const byDealer = {};
  unpaidInvoices.forEach(i => { byDealer[i.dealer] = (byDealer[i.dealer] || 0) + i.total; });
  const topOutstanding = Object.entries(byDealer).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, amt]) => ({ name, amt }));

  const monthsBack = [];
  for (let i = 5; i >= 0; i--) { const d = new Date(); d.setMonth(d.getMonth() - i); monthsBack.push(d.toISOString().slice(0, 7)); }
  const incomeExpenseData = monthsBack.map(m => {
    const income = paidInvoices.filter(i => i.paidDateISO && i.paidDateISO.slice(0, 7) === m).reduce((s, i) => s + i.total, 0);
    const supplierExp = supplierPayments.filter(p => p.dateISO.slice(0, 7) === m).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    const claimExp = approvedClaims.filter(c => c.dateISO.slice(0, 7) === m).reduce((s, c) => s + (parseFloat(c.amount) || 0), 0);
    return { month: new Date(m + "-01").toLocaleDateString("en-SG", { month: "short" }), Income: income, Expense: supplierExp + claimExp };
  });

  return (
    <div className="content">
      <div className="kpi-grid">
        <div className="kpi-card"><div className="kpi-val" style={{ color: "#10B981", fontSize: 19 }}>{sgd(totalIncome)}</div><div className="kpi-lbl">Income Received</div></div>
        <div className="kpi-card"><div className="kpi-val" style={{ color: "#B5715A", fontSize: 19 }}>{sgd(totalSupplierPayments)}</div><div className="kpi-lbl">Paid to Suppliers</div></div>
        <div className="kpi-card"><div className="kpi-val" style={{ color: "#9A7B4E", fontSize: 19 }}>{sgd(collectableThisMonth)}</div><div className="kpi-lbl">Collectable This Month</div></div>
        <div className="kpi-card"><div className="kpi-val" style={{ color: "#F59E0B", fontSize: 19 }}>{sgd(collectableNextMonth)}</div><div className="kpi-lbl">Collectable Next Month</div></div>
        <div className="kpi-card"><div className="kpi-val" style={{ color: "#EF4444", fontSize: 19 }}>{sgd(outstanding)}</div><div className="kpi-lbl">Total Outstanding</div></div>
      </div>

      <div className="card">
        <div className="card-title">Income vs Expense — Last 6 Months</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={incomeExpenseData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E8E1D6" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#8A8073" }} />
            <YAxis tick={{ fontSize: 11, fill: "#8A8073" }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Income" fill="#10B981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Expense" fill="#B5715A" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <div className="card-title">Outstanding Invoice Aging</div>
        <div className="card-sub">Unpaid invoice value by how overdue</div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={agingData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E8E1D6" />
            <XAxis dataKey="bucket" tick={{ fontSize: 9.5, fill: "#8A8073" }} />
            <YAxis tick={{ fontSize: 10, fill: "#8A8073" }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="amount" fill="#EF4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {topOutstanding.length > 0 && (
        <div className="card">
          <div className="card-title">Top Outstanding Dealers</div>
          <ResponsiveContainer width="100%" height={Math.max(120, topOutstanding.length * 36)}>
            <BarChart data={topOutstanding} layout="vertical" margin={{ top: 4, right: 20, left: 20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E1D6" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#8A8073" }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#221E1A", fontWeight: 600 }} width={110} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="amt" fill="#9A7B4E" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {worstLate.length > 0 && (
        <div className="card" style={{ borderColor: "#F6CDCD" }}>
          <div className="card-title" style={{ color: "#B91C1C" }}>Longest Overdue</div>
          {worstLate.map(i => (
            <div key={i.id} className="list-item" style={{ marginTop: 8 }}>
              <div className="item-meta"><div style={{ fontWeight: 700 }}>{i.dealer}</div><span className="badge badge-rejected">{i.overdue}d overdue</span></div>
              <div className="item-time">{i.refNo} · Due {i.dueDate} · {sgd(i.total)}</div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="card-title">Generate Monthly Tax Invoice</div>
        <div className="input-row-2">
          <div className="form-group"><div className="field-label">Dealer</div>
            <select className="field-select" value={genDealer} onChange={e => setGenDealer(e.target.value)}>
              <option value="">Select a dealer…</option>
              {dealers.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
          </div>
          <div className="form-group"><div className="field-label">Month</div><input className="field-input" type="month" value={genMonth} onChange={e => setGenMonth(e.target.value)} /></div>
        </div>
        <button className="btn btn-primary" onClick={generate}>Generate Tax Invoice</button>
        {lastGenerated && (
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => downloadInvoice(lastGenerated)}>⬇ Download {lastGenerated.refNo}</button>
            <button className="btn btn-ghost btn-sm" onClick={() => printInvoice(lastGenerated)}>🖨 Print</button>
          </div>
        )}
      </div>

      <div className="section-hdr"><div className="section-title">Tax Invoices ({invoices.length})</div></div>
      {invoices.length === 0 ? <div className="empty"><div className="empty-icon">🧾</div><div className="empty-lbl">No invoices generated yet.</div></div>
        : invoices.map(i => (
          <div className="list-item" key={i.id}>
            <div className="item-meta"><div style={{ fontWeight: 700 }}>{i.dealer}</div><span className={`badge ${i.status === "paid" ? "badge-reviewed" : "badge-pending"}`}>{i.status}</span></div>
            <div className="item-time">{i.refNo} · {i.monthLabel} · Due {i.dueDate}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#9A7B4E" }}>{sgd(i.total)}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button className="btn btn-ghost btn-xs" onClick={() => downloadInvoice(i)}>⬇ PDF</button>
              <button className="btn btn-ghost btn-xs" onClick={() => printInvoice(i)}>🖨 Print</button>
              {i.status !== "paid" && <button className="btn btn-green btn-xs" onClick={() => onMarkPaid(i.id)}>Mark Paid</button>}
            </div>
          </div>
        ))}

      <div className="card">
        <div className="card-title">Log Supplier Payment</div>
        <div className="form-group"><div className="field-label">Supplier</div><input className="field-input" placeholder="Supplier name" value={spSupplier} onChange={e => setSpSupplier(e.target.value)} /></div>
        <div className="input-row-2">
          <div className="form-group"><div className="field-label">Amount (SGD)</div><input className="field-input" type="number" inputMode="decimal" placeholder="0.00" value={spAmount} onChange={e => setSpAmount(e.target.value)} /></div>
          <div className="form-group"><div className="field-label">Notes</div><input className="field-input" placeholder="What was this for?" value={spNotes} onChange={e => setSpNotes(e.target.value)} /></div>
        </div>
        <button className="btn btn-primary" onClick={addSp}>Log Payment</button>
      </div>
      <div className="section-hdr"><div className="section-title">Supplier Payments ({supplierPayments.length})</div></div>
      {supplierPayments.length === 0 ? <div className="empty"><div className="empty-icon">📦</div><div className="empty-lbl">No supplier payments logged yet.</div></div>
        : supplierPayments.map(p => (
          <div className="list-item" key={p.id}>
            <div className="item-meta"><div style={{ fontWeight: 700 }}>{p.supplier}</div><div style={{ fontWeight: 700, color: "#B5715A" }}>{sgd(p.amount)}</div></div>
            <div className="item-time">{p.date} · by {p.by}</div>
            {p.notes && <div style={{ fontSize: 12, color: "#8A8073" }}>{p.notes}</div>}
          </div>
        ))}
    </div>
  );
}

// ── BALANCE SHEET (super admin) ───────────────────────────────────────────────
function BalanceSheetPage({ invoices, supplierPayments, claims }) {
  const [view, setView] = useState("month");
  const approvedClaims = claims.filter(c => c.status === "approved");
  const paidInvoices = invoices.filter(i => i.status === "paid" && i.paidDateISO);

  const periods = {};
  const bump = (key, field, amt) => { if (!periods[key]) periods[key] = { in: 0, out: 0 }; periods[key][field] += amt; };
  const periodKey = iso => view === "month" ? iso.slice(0, 7) : iso.slice(0, 4);

  paidInvoices.forEach(i => bump(periodKey(i.paidDateISO), "in", i.total));
  supplierPayments.forEach(p => bump(periodKey(p.dateISO), "out", parseFloat(p.amount) || 0));
  approvedClaims.forEach(c => bump(periodKey(c.dateISO), "out", parseFloat(c.amount) || 0));

  const sortedKeys = Object.keys(periods).sort();
  const rows = sortedKeys.map(k => ({
    period: view === "month" ? new Date(k + "-01").toLocaleDateString("en-SG", { month: "long", year: "numeric" }) : k,
    key: k, in: periods[k].in, out: periods[k].out, net: periods[k].in - periods[k].out,
  }));
  const chartData = rows.map(r => ({ label: view === "month" ? new Date(r.key + "-01").toLocaleDateString("en-SG", { month: "short", year: "2-digit" }) : r.key, In: r.in, Out: r.out }));
  const totalIn = rows.reduce((s, r) => s + r.in, 0);
  const totalOut = rows.reduce((s, r) => s + r.out, 0);

  return (
    <div className="content">
      <div className="section-hdr">
        <div className="section-title">Balance Sheet</div>
        <div className="filter-tabs">
          <button className={`btn btn-xs ${view === "month" ? "btn-primary" : "btn-ghost"}`} onClick={() => setView("month")}>Monthly</button>
          <button className={`btn btn-xs ${view === "year" ? "btn-primary" : "btn-ghost"}`} onClick={() => setView("year")}>Yearly</button>
        </div>
      </div>
      <div className="card-sub">In = payments received from dealers. Out = supplier payments + approved claims.</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <div className="kpi-card"><div className="kpi-val" style={{ color: "#10B981" }}>{sgd(totalIn)}</div><div className="kpi-lbl">Total In</div></div>
        <div className="kpi-card"><div className="kpi-val" style={{ color: "#B5715A" }}>{sgd(totalOut)}</div><div className="kpi-lbl">Total Out</div></div>
        <div className="kpi-card"><div className="kpi-val" style={{ color: totalIn - totalOut >= 0 ? "#10B981" : "#EF4444" }}>{sgd(totalIn - totalOut)}</div><div className="kpi-lbl">Net</div></div>
      </div>
      {chartData.length > 0 && (
        <div className="card">
          <div className="card-title">{view === "month" ? "Monthly" : "Yearly"} In vs Out</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E1D6" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#8A8073" }} />
              <YAxis tick={{ fontSize: 11, fill: "#8A8073" }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="In" fill="#10B981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Out" fill="#B5715A" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {rows.length === 0 ? <div className="empty"><div className="empty-icon">📒</div><div className="empty-lbl">No income or expense recorded yet.</div></div>
        : [...rows].reverse().map(r => (
          <div className="list-item" key={r.key}>
            <div className="item-meta"><div style={{ fontWeight: 700 }}>{r.period}</div><div style={{ fontWeight: 800, color: r.net >= 0 ? "#10B981" : "#EF4444" }}>{sgd(r.net)}</div></div>
            <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#8A8073" }}>
              <span>In: <strong style={{ color: "#10B981" }}>{sgd(r.in)}</strong></span>
              <span>Out: <strong style={{ color: "#B5715A" }}>{sgd(r.out)}</strong></span>
            </div>
          </div>
        ))}
    </div>
  );
}

// ── DATA MANAGEMENT (super admin) ─────────────────────────────────────────────
function SystemPage({ logs, damages, docs, dealers, products, tasks, trash, notices, onLoad, onClear }) {
  const rows = [["Daily logs", logs.length], ["Damage", damages.length], ["Documents", docs.length], ["Dealers", dealers.length], ["Products", products.length], ["Tasks", tasks.length], ["Trash", trash.length], ["Notices", notices.length]];
  const load = () => { if (window.confirm("Load sample test data? This overwrites current logs, documents, dealers, products, tasks, trash and notices. User accounts are kept.")) onLoad(); };
  const clear = () => { if (window.confirm("Delete ALL business data (logs, documents, dealers, products, tasks, trash, notices)? User accounts are kept. This cannot be undone.")) onClear(); };
  return (
    <div className="content">
      <div className="card">
        <div className="card-title">Current Data</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {rows.map(([l, n]) => (
            <div key={l} style={{ background: "var(--bg)", borderRadius: 10, padding: "12px 8px", textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#9A7B4E" }}>{n}</div>
              <div style={{ fontSize: 10, color: "#8A8073", textTransform: "uppercase", fontWeight: 600 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <div className="card-title">Load Test Data</div>
        <div className="card-sub" style={{ marginBottom: 14 }}>Fills the app with sample dealers, products, daily logs, documents, tasks, notices and an empty trash so you can try things out. Overwrites the current business data — user accounts are kept.</div>
        <button className="btn btn-primary" onClick={load}>Load Test Data</button>
      </div>
      <div className="card" style={{ borderColor: "#F6CDCD" }}>
        <div className="card-title" style={{ color: "#B91C1C" }}>Clear All Data</div>
        <div className="card-sub" style={{ marginBottom: 14 }}>Permanently removes all logs, damage reports, documents, dealers, products, tasks, trash and notices, leaving a clean slate for real use. User accounts are kept. This cannot be undone.</div>
        <button className="btn btn-danger" onClick={clear}>Clear All Data</button>
      </div>
    </div>
  );
}

// ── MODALS ────────────────────────────────────────────────────────────────────
function LogModal({ user, dealers, products, onSave, onClose }) {
  const [dealer,setDealer]=useState("");
  const [product,setProduct]=useState("");
  const [delivered,setDelivered]=useState("");
  const [returned,setReturned]=useState("");
  const [exchanged,setExchanged]=useState("");
  const [notes,setNotes]=useState(""); const [photo,setPhoto]=useState(null);
  const [err,setErr]=useState("");
  const hp=e=>handlePhoto(e,setPhoto);
  const prod = products.find(p=>p.name===product);
  const price = prod ? Number(prod.price)||0 : 0;
  const amount = price * (Number(delivered)||0);
  const save=()=>{
    if(!dealer||!product){ setErr("Please select a dealer and a product."); return; }
    if(!delivered&&!returned&&!exchanged){ setErr("Enter a delivered, returned or exchanged quantity."); return; }
    onSave({
      id: Date.now(),
      dealer, product, price,
      sold: Number(delivered)||0, returned: Number(returned)||0, exchanged: Number(exchanged)||0,
      notes, photo, by:user.name, date:todayStr(), dateISO:todayISO(), time:fmtTime(),
    });
  };
  return (
    <div className="modal-overlay" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-handle"/><div className="modal-title">New Order</div>
      <div className="form-group"><div className="field-label">Dealer</div>
        <select className="field-select" value={dealer} onChange={e=>setDealer(e.target.value)}>
          <option value="">Select an approved dealer…</option>
          {dealers.map(d=><option key={d.id} value={d.name}>{d.name}</option>)}
        </select>
      </div>
      <div className="form-group"><div className="field-label">Product</div>
        <select className="field-select" value={product} onChange={e=>setProduct(e.target.value)}>
          <option value="">Select a product…</option>
          {products.map(p=><option key={p.id} value={p.name}>{p.name}{p.price?` — $${p.price}`:""}</option>)}
        </select>
      </div>
      <div className="input-row-3">
        <div className="form-group"><div className="field-label">Delivered</div><input className="field-input" type="number" inputMode="numeric" placeholder="0" value={delivered} onChange={e=>setDelivered(e.target.value)}/></div>
        <div className="form-group"><div className="field-label">Returned</div><input className="field-input" type="number" inputMode="numeric" placeholder="0" value={returned} onChange={e=>setReturned(e.target.value)}/></div>
        <div className="form-group"><div className="field-label">Exchanged</div><input className="field-input" type="number" inputMode="numeric" placeholder="0" value={exchanged} onChange={e=>setExchanged(e.target.value)}/></div>
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:11.5, color:"#8A8073" }}>
        <span>Returned = damage · Exchanged = wrong size</span>
        {amount>0 && <span style={{fontWeight:700, color:"#221E1A"}}>Amount ${amount.toLocaleString("en-SG",{minimumFractionDigits:2})}</span>}
      </div>
      <div className="form-group"><div className="field-label">Notes</div><input className="field-input" placeholder="Any remarks..." value={notes} onChange={e=>setNotes(e.target.value)}/></div>
      <div className="form-group"><div className="field-label">Photo (optional)</div>
        <div className="photo-zone"><input type="file" accept="image/*" capture="environment" onChange={hp}/>{photo?<img src={photo} alt="p" className="photo-preview"/>:<><div className="photo-icon">📷</div><div className="photo-lbl">Tap to upload photo</div></>}</div>
      </div>
      {err && <div className="login-err">{err}</div>}
      <div className="modal-actions"><button className="btn btn-primary" style={{flex:1}} onClick={save}>Create Order</button><button className="btn btn-ghost" onClick={onClose}>Cancel</button></div>
    </div></div>
  );
}

function OrderCreatedModal({ order, onClose }) {
  const card = (title, ref, kind) => (
    <div className="card" style={{ boxShadow: "none" }}>
      <div className="card-title" style={{ marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 11, color: "#8A8073", marginBottom: 10 }}>{ref}</div>
      <div style={{ display: "flex", gap: 6 }}>
        <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => downloadDoc(order, kind)}>Download</button>
        <button className="btn btn-ghost btn-sm" onClick={() => printDoc(order, kind)}>Print</button>
      </div>
    </div>
  );
  return (
    <div className="modal-overlay" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-handle"/>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 40 }}>✅</div>
        <div className="modal-title" style={{ textAlign: "center" }}>Order Created</div>
        <div style={{ fontSize: 13, color: "#8A8073", marginTop: 4 }}>{order.sold} × {order.product} · {order.dealer}</div>
      </div>
      <div className="input-row-2">
        {card("Purchase Order", order.poNo, "PO")}
        {card("Delivery Order", order.doNo, "DO")}
      </div>
      <div className="modal-actions"><button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Done</button></div>
    </div></div>
  );
}

function DamageModal({ user, onSave, onClose }) {
  const [itemDesc,setItemDesc]=useState(""); const [qty,setQty]=useState(""); const [notes,setNotes]=useState(""); const [photo,setPhoto]=useState(null);
  const hp=e=>handlePhoto(e,setPhoto);
  const save=()=>{if(!itemDesc)return;onSave({itemDesc,qty,notes,photo,by:user.name,date:todayStr(),dateISO:todayISO(),status:"pending"});};
  return (
    <div className="modal-overlay" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-handle"/><div className="modal-title">Report Damage Return</div>
      <div className="form-group"><div className="field-label">Item Description</div><input className="field-input" placeholder="Describe the damaged item" value={itemDesc} onChange={e=>setItemDesc(e.target.value)}/></div>
      <div className="form-group"><div className="field-label">Quantity</div><input className="field-input" type="number" inputMode="numeric" placeholder="0" value={qty} onChange={e=>setQty(e.target.value)}/></div>
      <div className="form-group"><div className="field-label">Notes</div><input className="field-input" placeholder="Describe the damage..." value={notes} onChange={e=>setNotes(e.target.value)}/></div>
      <div className="form-group"><div className="field-label">Photo of Damage</div>
        <div className="photo-zone"><input type="file" accept="image/*" capture="environment" onChange={hp}/>{photo?<img src={photo} alt="p" className="photo-preview"/>:<><div className="photo-icon">📷</div><div className="photo-lbl">Tap to photograph the damage</div></>}</div>
      </div>
      <div className="modal-actions"><button className="btn btn-primary" style={{flex:1}} onClick={save}>Submit Report</button><button className="btn btn-ghost" onClick={onClose}>Cancel</button></div>
    </div></div>
  );
}

function DocModal({ user, type, onSave, onClose }) {
  const [refNo,setRefNo]=useState(""); const [party,setParty]=useState(""); const [amount,setAmount]=useState(""); const [notes,setNotes]=useState(""); const [photo,setPhoto]=useState(null);
  const hp=e=>handlePhoto(e,setPhoto);
  const label=type==="DO"?"Delivery Order":type==="PO"?"Purchase Order":"Monthly Bill";
  const save=()=>onSave({type,refNo,party,amount,notes,photo,by:user.name,date:todayStr(),dateISO:todayISO()});
  return (
    <div className="modal-overlay" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-handle"/><div className="modal-title">Add {label}</div>
      <div className="form-group"><div className="field-label">Reference No.</div><input className="field-input" placeholder={type==="DO"?"DO-XXXX":type==="PO"?"PO-XXXX":"INV-XXXX"} value={refNo} onChange={e=>setRefNo(e.target.value)}/></div>
      <div className="form-group"><div className="field-label">{type==="DO"?"Delivered To":type==="PO"?"Supplier":"Billed By"}</div><input className="field-input" placeholder="Company / name" value={party} onChange={e=>setParty(e.target.value)}/></div>
      <div className="form-group"><div className="field-label">Amount (SGD)</div><input className="field-input" type="number" inputMode="decimal" placeholder="0.00" value={amount} onChange={e=>setAmount(e.target.value)}/></div>
      <div className="form-group"><div className="field-label">Notes</div><input className="field-input" placeholder="Remarks..." value={notes} onChange={e=>setNotes(e.target.value)}/></div>
      <div className="form-group"><div className="field-label">Photo / Scan</div>
        <div className="photo-zone"><input type="file" accept="image/*" capture="environment" onChange={hp}/>{photo?<img src={photo} alt="p" className="photo-preview"/>:<><div className="photo-icon">📷</div><div className="photo-lbl">Tap to photograph document</div></>}</div>
      </div>
      <div className="modal-actions"><button className="btn btn-primary" style={{flex:1}} onClick={save}>Save Document</button><button className="btn btn-ghost" onClick={onClose}>Cancel</button></div>
    </div></div>
  );
}

function UserModal({ editUser, users, setUsers, onClose }) {
  const [name,setName]=useState(editUser?.name||""); const [role,setRole]=useState(editUser?.role||"salesperson"); const [pin,setPin]=useState(editUser?.pin||"");
  const save=()=>{
    if(!name||!pin)return;
    if(editUser){setUsers(users.map(u=>u.id===editUser.id?{...u,name,role,pin}:u));}
    else{setUsers([...users,{id:Date.now(),name,role,pin}]);}
    onClose();
  };
  return (
    <div className="modal-overlay" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-handle"/><div className="modal-title">{editUser?"Edit User":"Add User"}</div>
      <div className="form-group"><div className="field-label">Name</div><input className="field-input" placeholder="Display name" value={name} onChange={e=>setName(e.target.value)}/></div>
      <div className="form-group"><div className="field-label">Role</div>
        <div className="role-row">
          <button className={`role-btn ${role==="salesperson"?"active":""}`} onClick={()=>setRole("salesperson")}>Salesperson</button>
          <button className={`role-btn ${role==="installer"?"active":""}`} onClick={()=>setRole("installer")}>Installer</button>
          <button className={`role-btn ${role==="admin"?"active":""}`} onClick={()=>setRole("admin")}>Admin</button>
        </div>
        {role === "installer" && <div style={{ fontSize: 11, color: "#8A8073", marginTop: 6 }}>One account per installer company — use the company name.</div>}
      </div>
      <div className="form-group"><div className="field-label">PIN</div><input className="field-input" type="password" inputMode="numeric" maxLength={6} placeholder="Set PIN" value={pin} onChange={e=>setPin(e.target.value)}/></div>
      <div className="modal-actions"><button className="btn btn-primary" style={{flex:1}} onClick={save}>{editUser?"Save Changes":"Create User"}</button><button className="btn btn-ghost" onClick={onClose}>Cancel</button></div>
    </div></div>
  );
}
