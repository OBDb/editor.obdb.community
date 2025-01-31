import React, { useState, useMemo, useRef } from 'react';

const ByteVisualizer = ({ signals }) => {
  const [hoveredSignal, setHoveredSignal] = useState(null);
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  const byteMap = useMemo(() => {
    // Calculate the total number of bytes based on the maximum bit index and length
    const maxBitIndex = signals.reduce((max, signal) => {
      if (!signal.fmt) return max;
      const signalMaxBit = (signal.fmt.bix || 0) + (signal.fmt.len || 0);
      return Math.max(max, signalMaxBit);
    }, 0);

    const totalBytes = Math.ceil(maxBitIndex / 8);
    const bytes = new Array(totalBytes).fill(null);
    
    signals.forEach(signal => {
      if (!signal.fmt) return;
      
      const { bix = 0, len = 0 } = signal.fmt;
      const startByte = Math.floor(bix / 8);
      const endByte = Math.floor((bix + len - 1) / 8);
      
      for (let i = startByte; i <= endByte; i++) {
        if (!bytes[i]) bytes[i] = [];
        bytes[i].push(signal);
      }
    });
    
    return bytes;
  }, [signals]);
  
  const getByteClass = (signal, isHovered) => {
    if (!signal) return 'bg-gray-100 text-gray-400';
    
    if (isHovered) {
      return 'bg-green-500 text-white';
    }
    
    return 'bg-blue-500 text-white';
  };

  const renderSignalDetails = (signal) => {
    if (!signal) return null;
    const { fmt, name, id, path } = signal;
    return (
      <div className="text-sm">
        <p><strong>Name:</strong> {name}</p>
        <p><strong>ID:</strong> {id}</p>
        {path && <p><strong>Path:</strong> {path}</p>}
        {fmt && (
          <div>
            <p><strong>Format:</strong></p>
            <ul>
              {fmt.bix !== undefined && <li>Bit Index: {fmt.bix}</li>}
              {fmt.len !== undefined && <li>Length: {fmt.len}</li>}
              {fmt.unit && <li>Unit: {fmt.unit}</li>}
              {fmt.min !== undefined && <li>Min: {fmt.min}</li>}
              {fmt.max !== undefined && <li>Max: {fmt.max}</li>}
            </ul>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-1 mt-2 mb-2">
        {byteMap.map((signals, index) => (
          <div 
            key={index}
            className={`w-8 h-8 border rounded flex items-center justify-center cursor-pointer transition-colors 
              ${getByteClass(
                hoveredSignal ? 
                  (signals?.some(s => s === hoveredSignal) ? hoveredSignal : null) 
                  : signals?.[0], 
                !!hoveredSignal
              )}`}
            onMouseEnter={() => signals && signals.length > 0 && setHoveredSignal(signals[0])}
            onMouseLeave={() => setHoveredSignal(null)}
          >
            {String.fromCharCode(65 + index)}
          </div>
        ))}
      </div>
      
      {hoveredSignal && (
        <div className="bg-gray-100 p-2 rounded mt-2 shadow-sm">
          {renderSignalDetails(hoveredSignal)}
        </div>
      )}
    </div>
  );
};

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
          .filter(([key, value]) => {
            if (value === undefined) return false;
            if (value === null) return false;
            if (typeof value === 'number' && isNaN(value)) return false;
            // Retain properties with explicit zero or empty string values
            return true;
          })
          .map(([key, value]) => `"${key}": ${JSON.stringify(value)}`)
          .join(", ");
        
        const paddedId = (signal.id || "");
        const paddedPath = (signal.path || "");
        
        return `    {"id": "${paddedId}", "path": "${paddedPath}", "fmt": {${fmtStr}}, "name": ${JSON.stringify(signal.name)}${signal.suggestedMetric ? `, "suggestedMetric": ${JSON.stringify(signal.suggestedMetric)}` : ''}}`;
      }).join(',\n');
    };
    
    const formatCommand = (command) => {
      const cmdProps = Object.entries(command)
        .filter(([key]) => key !== 'signals')
        .filter(([_, value]) => value !== '') // Filter out empty string values
        .filter(([key, value]) => !(key === 'fcm1' && value === false)) // Filter out "fcm1": false
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
              className="w-full h-[calc(100vh-300px)] font-mono text-sm p-2 border rounded whitespace-pre overflow-x-auto"
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
                      Delete command
                    </button>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Byte Mapping</label>
                  <ByteVisualizer signals={command.signals} />
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
                    <label className="block text-sm mb-1">Receive address (rax)</label>
                    <input
                      className="w-full px-3 py-2 border rounded shadow-sm"
                      value={command.rax || ''}
                      onChange={(e) => handleStructuredEdit(cmdIndex, -1, 'rax', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Extended address (eax)</label>
                    <input
                      className="w-full px-3 py-2 border rounded shadow-sm"
                      value={command.eax || ''}
                      onChange={(e) => handleStructuredEdit(cmdIndex, -1, 'eax', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Tester address (tst)</label>
                    <input
                      className="w-full px-3 py-2 border rounded shadow-sm"
                      value={command.tst || ''}
                      onChange={(e) => handleStructuredEdit(cmdIndex, -1, 'tst', e.target.value)}
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
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`fcm1-${cmdIndex}`}
                      className="w-4 h-4 rounded border-gray-300"
                      checked={command.fcm1 || false}
                      onChange={(e) => handleStructuredEdit(cmdIndex, -1, 'fcm1', e.target.checked)}
                    />
                    <label htmlFor={`fcm1-${cmdIndex}`} className="text-sm">
                      Enable FCM1
                    </label>
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
                            <label className="block text-sm mb-1">Bit offset (bix)</label>
                            <input
                              className="w-full px-3 py-2 border rounded shadow-sm"
                              type="number"
                              value={signal.fmt?.bix || ''}
                              onChange={(e) => handleStructuredEdit(
                                cmdIndex,
                                sigIndex,
                                'fmt',
                                { ...signal.fmt, bix: parseInt(e.target.value) }
                              )}
                            />
                          </div>
                          <div>
                            <label className="block text-sm mb-1">Bit length (len)</label>
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
                            <label className="block text-sm mb-1">Minimum value (min)</label>
                            <input
                              className="w-full px-3 py-2 border rounded shadow-sm"
                              type="number"
                              value={signal.fmt?.min || ''}
                              onChange={(e) => handleStructuredEdit(
                                cmdIndex,
                                sigIndex,
                                'fmt',
                                { ...signal.fmt, min: parseInt(e.target.value) }
                              )}
                            />
                          </div>
                          <div>
                            <label className="block text-sm mb-1">Maximum value (max)</label>
                            <input
                              className="w-full px-3 py-2 border rounded shadow-sm"
                              type="number"
                              value={signal.fmt?.max || ''}
                              onChange={(e) => handleStructuredEdit(
                                cmdIndex,
                                sigIndex,
                                'fmt',
                                { ...signal.fmt, max: parseInt(e.target.value) }
                              )}
                            />
                          </div>
                          <div>
                            <label className="block text-sm mb-1">Add (add)</label>
                            <input
                              className="w-full px-3 py-2 border rounded shadow-sm"
                              type="number"
                              value={signal.fmt?.add || ''}
                              onChange={(e) => handleStructuredEdit(
                                cmdIndex,
                                sigIndex,
                                'fmt',
                                { ...signal.fmt, add: parseInt(e.target.value) }
                              )}
                            />
                          </div>
                          <div>
                            <label className="block text-sm mb-1">Multiply by (mul)</label>
                            <input
                              className="w-full px-3 py-2 border rounded shadow-sm"
                              type="number"
                              value={signal.fmt?.mul || ''}
                              onChange={(e) => handleStructuredEdit(
                                cmdIndex,
                                sigIndex,
                                'fmt',
                                { ...signal.fmt, mul: parseInt(e.target.value) }
                              )}
                            />
                          </div>
                          <div>
                            <label className="block text-sm mb-1">Divide by (mul)</label>
                            <input
                              className="w-full px-3 py-2 border rounded shadow-sm"
                              type="number"
                              value={signal.fmt?.div || ''}
                              onChange={(e) => handleStructuredEdit(
                                cmdIndex,
                                sigIndex,
                                'fmt',
                                { ...signal.fmt, div: parseInt(e.target.value) }
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