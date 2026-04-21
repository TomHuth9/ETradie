import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="footer">
      <span>© {new Date().getFullYear()} etradie</span>
      <nav className="footer-nav">
        <Link to="/" className="footer-link">About</Link>
        <Link to="/" className="footer-link">Privacy</Link>
        <Link to="/" className="footer-link">Terms</Link>
        <Link to="/" className="footer-link">Contact</Link>
      </nav>
    </footer>
  );
}
