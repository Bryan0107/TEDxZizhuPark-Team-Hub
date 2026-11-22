/**
 * 登录页协议弹层：使用协议 / 隐私权保护协议。
 * 内容来自 legalContent.js（由平台协议 HTML 整理，已去掉文末签署块）。
 */
import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { LEGAL_META, LEGAL_TERMS, LEGAL_PRIVACY } from './legalContent';

export default function LegalDocModal({ doc, onClose }) {
  const data = doc === 'privacy' ? LEGAL_PRIVACY : LEGAL_TERMS;
  const closeRef = useRef(null);

  useEffect(() => {
    const onKey = event => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="legal-overlay"
      role="presentation"
      onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section className="legal-sheet" role="dialog" aria-modal="true" aria-labelledby="legal-title">
        <header className="legal-head">
          <div>
            <h2 id="legal-title">{data.title}</h2>
            <p>{data.fullTitle} · 生效日期 {LEGAL_META.effective}</p>
            <p>运营主体：{LEGAL_META.operator} · 联系邮箱：{LEGAL_META.email}</p>
          </div>
          <button type="button" className="legal-close" onClick={onClose} aria-label="关闭协议" ref={closeRef}>
            <X size={18} />
          </button>
        </header>
        <div className="legal-body">
          {data.blocks.map((block, index) => {
            if (block.type === 'h2') return <h3 key={index}>{block.text}</h3>;
            if (block.type === 'list') return <ul key={index}>{block.items.map((item, i) => <li key={i}>{item}</li>)}</ul>;
            if (block.type === 'notice') return <p className="legal-notice" key={index}>{block.text}</p>;
            return <p key={index}>{block.text}</p>;
          })}
        </div>
        <footer className="legal-foot">
          <button type="button" className="legal-accept" onClick={onClose}>我已阅读</button>
        </footer>
      </section>
    </div>
  );
}
