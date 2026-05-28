import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="hero-panel overflow-hidden text-center">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(61,214,198,0.12),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(108,140,255,0.08),transparent_24%)]" />
      <div className="relative mx-auto flex max-w-xl flex-col items-center p-8 sm:p-10">
        <div className="hero-badge">
          <span className="h-2 w-2 rounded-full bg-warm" />
          404
        </div>
        <h1 className="mt-4 font-display text-4xl font-bold text-white sm:text-5xl">This page drifted off the shelf.</h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-300">
          The storefront route you requested does not exist. Jump back to the catalog, browse the latest releases, or return to the spotlight.
        </p>
        <div className="mt-6 grid w-full gap-3 sm:grid-cols-2">
          <Link to="/" className="primary-button inline-flex justify-center">
            Back to home
          </Link>
          <Link to="/catalog" className="secondary-button inline-flex justify-center">
            Open catalog
          </Link>
        </div>
      </div>
    </div>
  );
}