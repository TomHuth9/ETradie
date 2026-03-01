import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <Link to="/" className="logo" style={{ fontSize: '1rem' }}>
          ETradie
        </Link>
        <nav className="footer-nav">
          <span className="footer-link">About</span>
          <span className="footer-link">Contact</span>
        </nav>
        <p className="footer-copy">
          © {new Date().getFullYear()} ETradie. Connect with local tradespeople.
        </p>
      </div>
    </footer>
  );
}
