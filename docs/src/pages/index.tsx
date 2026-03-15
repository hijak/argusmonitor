import React from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';

export default function Home(): JSX.Element {
  return (
    <Layout title="ArgusMonitor Docs" description="Self-hosted docs for ArgusMonitor">
      <header className="hero hero--primary" style={{padding: '5rem 0'}}>
        <div className="container">
          <h1 className="hero__title">ArgusMonitor Docs</h1>
          <p className="hero__subtitle">AI-powered monitoring, lightweight agents, and safer operational workflows.</p>
          <div style={{display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem'}}>
            <Link className="button button--primary button--lg" to="/docs/intro">Read the docs</Link>
            <Link className="button button--secondary button--lg" to="/docs/quickstart">Quickstart</Link>
          </div>
        </div>
      </header>
    </Layout>
  );
}
