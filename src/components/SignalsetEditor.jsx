import React, { useState } from 'react';

const SignalsetEditor = () => {
  const [jsonText, setJsonText] = useState('');
  const [parsedData, setParsedData] = useState(null);
  const [error, setError] = useState(null);
  const [githubUrl, setGithubUrl] = useState('');

  const formatSignalset = (data) => {
    if (!data || !data.commands) return '';
    
    const alignSignals = (signals) => {
      const maxLengths = signals.reduce((acc, signal) => {
        acc.id = Math.max(acc.id, signal.id?.length || 0);
        acc.path = Math.max(acc.path, signal.path?.length || 0);
        return acc;
      }, { id: 0, path: 0 });
      
      return signals.map(signal => {
        const fmt = signal.fmt || {};
        const fmtStr = Object.entries(fmt)
          .map(([key, value]) => `"${key}": ${JSON.stringify(value)}`)
          .join(", ");
        
        const paddedId = (signal.id || "").padEnd(maxLengths.id);
        const paddedPath = (signal.path || "").padEnd(maxLengths.path);
        
        return `    {"id": "${paddedId}", "path": "${paddedPath}", "fmt": {${fmtStr}}, "name": ${JSON.stringify(signal.name)}${signal.suggestedMetric ? `, "suggestedMetric": ${JSON.stringify(signal.suggestedMetric)}` : ''}}`;
      }).join(',\n');
    };
    
    const formatCommand = (command) => {
      const cmdProps = Object.entries(command)
        .filter(([key]) => key !== 'signals')
        .map(([key, value]) => `"${key}": ${JSON.stringify(value)}`)
        .join(', ');
      
      const signalsStr = alignSignals(command.signals || []);
      
      return `{ ${cmdProps},\n  "signals": [\n${signalsStr}\n  ]}`;
    };
    
    return `{ "commands": [\n${data.commands.map(formatCommand).join(',\n')}\n]}\n`;
  };

  const validateJson = (text) => {
    try {
      const data = JSON.parse(text);
      if (!data.commands || !Array.isArray(data.commands)) {
        throw new Error('Invalid signalset format: missing or invalid commands array');
      }
      setError(null);
      return data;
    } catch (e) {
      setError(e.message);
      return null;
    }
  };

  const handleJsonChange = (text) => {
    setJsonText(text);
    const data = validateJson(text);
    if (data) {
      setParsedData(data);
    }
  };

  const handleStructuredEdit = (commandIndex, signalIndex, field, value) => {
    const newData = JSON.parse(JSON.stringify(parsedData));
    if (signalIndex === -1) {
      newData.commands[commandIndex][field] = value;
    } else {
      newData.commands[commandIndex].signals[signalIndex][field] = value;
    }
    setParsedData(newData);
    setJsonText(formatSignalset(newData));
  };

  const addNewCommand = () => {
    const newData = JSON.parse(JSON.stringify(parsedData || { commands: [] }));
    newData.commands.push({
      hdr: "000",
      cmd: { "22": "0000" },
      freq: 1,
      signals: []
    });
    setParsedData(newData);
    setJsonText(formatSignalset(newData));
  };

  const addNewSignal = (commandIndex) => {
    const newData = JSON.parse(JSON.stringify(parsedData));
    newData.commands[commandIndex].signals.push({
      id: `NEW_SIGNAL_${Date.now()}`,
      path: "",
      fmt: { len: 8, unit: "scalar" },
      name: "New Signal"
    });
    setParsedData(newData);
    setJsonText(formatSignalset(newData));
  };

  const removeCommand = (commandIndex) => {
    const newData = JSON.parse(JSON.stringify(parsedData));
    newData.commands.splice(commandIndex, 1);
    setParsedData(newData);
    setJsonText(formatSignalset(newData));
  };

  const removeSignal = (commandIndex, signalIndex) => {
    const newData = JSON.parse(JSON.stringify(parsedData));
    newData.commands[commandIndex].signals.splice(signalIndex, 1);
    setParsedData(newData);
    setJsonText(formatSignalset(newData));
  };

  const fetchFromGithub = async () => {
    try {
      const rawUrl = githubUrl
        .replace('github.com', 'raw.githubusercontent.com')
        .replace('/blob/', '/');
      
      const response = await fetch(rawUrl);
      const text = await response.text();
      handleJsonChange(text);
    } catch (e) {
      setError('Failed to fetch from GitHub: ' + e.message);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 max-w-full">
      <div className="flex gap-4 items-center">
        <input 
          className="flex-grow px-3 py-2 border rounded shadow-sm"
          placeholder="GitHub URL (e.g., https://github.com/OBDb/Toyota-RAV4/blob/main/signalsets/v3/default.json)"
          value={githubUrl}
          onChange={(e) => setGithubUrl(e.target.value)}
        />
        <button 
          onClick={fetchFromGithub}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-2 shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Fetch
        </button>
      </div>

      {error && (
        <div className="text-red-500 p-2 rounded bg-red-100 shadow-sm">{error}</div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="border rounded-lg overflow-hidden shadow-sm">
          <div className="bg-gray-50 px-4 py-3 border-b">
            <h2 className="text-lg font-semibold">JSON Editor</h2>
          </div>
          <div className="p-4">
            <textarea
              className="w-full h-[calc(100vh-300px)] font-mono text-sm p-2 border rounded"
              value={jsonText}
              onChange={(e) => handleJsonChange(e.target.value)}
            />
          </div>
        </div>

        <div className="border rounded-lg overflow-hidden shadow-sm">
          <div className="bg-gray-50 px-4 py-3 border-b flex justify-between items-center">
            <h2 className="text-lg font-semibold">Structured Editor</h2>
            <button 
              onClick={addNewCommand}
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Command
            </button>
          </div>
          <div className="p-4 space-y-6 max-h-[calc(100vh-300px)] overflow-auto">
            {parsedData?.commands.map((command, cmdIndex) => (
              <div key={cmdIndex} className="border rounded-lg p-4 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Command {cmdIndex + 1}</h3>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => addNewSignal(cmdIndex)}
                      className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Signal
                    </button>
                    <button 
                      onClick={() => removeCommand(cmdIndex)}
                      className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Remove
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div>
                    <label className="block text-sm mb-1">Header (hdr)</label>
                    <input
                      className="w-full px-3 py-2 border rounded shadow-sm"
                      value={command.hdr || ''}
                      onChange={(e) => handleStructuredEdit(cmdIndex, -1, 'hdr', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Frequency (freq)</label>
                    <input
                      className="w-full px-3 py-2 border rounded shadow-sm"
                      type="number"
                      value={command.freq || ''}
                      onChange={(e) => handleStructuredEdit(cmdIndex, -1, 'freq', parseFloat(e.target.value))}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  {command.signals.map((signal, sigIndex) => (
                    <div key={sigIndex} className="border rounded-lg p-4 shadow-sm">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-medium">Signal {sigIndex + 1}</h4>
                        <button 
                          onClick={() => removeSignal(cmdIndex, sigIndex)}
                          className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 flex items-center gap-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Remove
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-sm mb-1">ID</label>
                          <input
                            className="w-full px-3 py-2 border rounded shadow-sm"
                            value={signal.id || ''}
                            onChange={(e) => handleStructuredEdit(cmdIndex, sigIndex, 'id', e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-sm mb-1">Name</label>
                          <input
                            className="w-full px-3 py-2 border rounded shadow-sm"
                            value={signal.name || ''}
                            onChange={(e) => handleStructuredEdit(cmdIndex, sigIndex, 'name', e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-sm mb-1">Path</label>
                          <input
                            className="w-full px-3 py-2 border rounded shadow-sm"
                            value={signal.path || ''}
                            onChange={(e) => handleStructuredEdit(cmdIndex, sigIndex, 'path', e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="mt-2">
                        <h5 className="text-sm font-medium mb-2">Format</h5>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-sm mb-1">Length</label>
                            <input
                              className="w-full px-3 py-2 border rounded shadow-sm"
                              type="number"
                              value={signal.fmt?.len || ''}
                              onChange={(e) => handleStructuredEdit(
                                cmdIndex,
                                sigIndex,
                                'fmt',
                                { ...signal.fmt, len: parseInt(e.target.value) }
                              )}
                            />
                          </div>
                          <div>
                            <label className="block text-sm mb-1">Unit</label>
                            <input
                              className="w-full px-3 py-2 border rounded shadow-sm"
                              value={signal.fmt?.unit || ''}
                              onChange={(e) => handleStructuredEdit(
                                cmdIndex,
                                sigIndex,
                                'fmt',
                                { ...signal.fmt, unit: e.target.value }
                              )}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignalsetEditor;