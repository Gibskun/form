import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';
import FormBuilder from './components/FormBuilder';
import FormFiller from './components/FormFiller';
import FormResponses from './components/FormResponses';
import ErrorBoundary from './components/ErrorBoundary';
import './App.css';

function App() {
  return (
    <ErrorBoundary>
      <Router
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true
        }}
      >
        <div className="App">
          <Routes>
            <Route path="/" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminLogin />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/create-form" element={<FormBuilder />} />
            <Route path="/admin/edit-form/:formId" element={<FormBuilder />} />
            <Route path="/admin/forms/:formId/responses" element={<FormResponses />} />
            <Route path="/form/:uniqueLink" element={<FormFiller />} />
          </Routes>
        </div>
      </Router>
    </ErrorBoundary>
  );
}

export default App;