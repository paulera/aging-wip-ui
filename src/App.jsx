import React, { useState, useMemo, useRef, useLayoutEffect, useEffect } from 'react';
import { Info, Filter, ArrowRight, Link as LinkIcon, Check, ChevronDown, X } from 'lucide-react';

// --- Mock Data ---
const MOCK_DATA = {
  "title": "Team Alpha MOCK Data - Aging WIP",
  "subtitle": "As of 2024/06/23",
  "board_url": "#",
  "min_days": 0,
  "max_days": 30,
  "theme": {
    "theme_name": "Default Theme",
    "theme_author_name": "System",
    "theme_author_email": "system@example.com",
    "sle_colors": ["#86efac", "#fef08a", "#fde047", "#fdba74", "#fca5a5"],
    "types": {
      "Task": { "color": "#3b82f6", "borderColor": "#2563eb", "icon": "1390" },
      "Bug": { "color": "#ef4444", "borderColor": "#dc2626", "icon": "BU" },
      "Story": { "color": "#10b981", "borderColor": "#059669", "icon": "US" }
    },
    "priorities": {
      "Highest": "H",
      "High": "M",
      "Medium": "L",
      "Low": "L",
      "Lowest": "L"
    }
  },
  "features": {
    "dependencies": {
      "enabled": true,
      "show_toggle": true,
      "default_visible": true,
      "arrow_color": "#303030",
      "arrow_thickness": 2
    },
    "filters": {
      "enabled": true,
      "fields": ["type", "assignee", "label", "parent", "priority"] 
    }
  },
  "columns": [
    {
      "name": "Analysis Active",
      "top_text": "WIP: 3",
      "order": 1,
      "sle": { "step1": 2, "step2": 5, "step3": 7, "step4": 12 },
      "items": [
        {
          "key": "KAN-202",
          "title": "Database Schema Review",
          "type": "Task",
          "age": 1,
          "priority": "High",
          "urgency": 3,
          "assignee": { "name": "Alice Dev", "picture": "https://i.pravatar.cc/150?img=10", "link": "#" },
          "labels": ["Backend", "DB"],
          "parent": { "key": "EPIC-1", "title": "Backend Overhaul", "url": "#" },
          "url": "https://jira.company.com/browse/KAN-202",
          "label": "202"
        },
        {
          "key": "KAN-205",
          "title": "Login Auth Bug",
          "type": "Bug",
          "age": 13,
          "priority": "Highest",
          "urgency": 4,
          "assignee": { "name": "Bob QA", "picture": "https://i.pravatar.cc/150?img=2", "link": "#" },
          "labels": ["Security"],
          "parent": { "key": "EPIC-2", "title": "Security Audit", "url": "#" },
          "url": "https://jira.company.com/browse/KAN-205",
          "depends_on": "KAN-202",
          "label": "205"
        },
        {
          "key": "KAN-206",
          "title": "Legacy Cleanup",
          "type": "Task",
          "age": 4,
          "priority": "Low",
          "urgency": 1,
          "assignee": { "name": "Charlie", "picture": "", "link": "#" },
          "labels": ["Tech Debt"],
          "parent": { "key": "EPIC-1", "title": "Backend Overhaul", "url": "#" },
          "url": "https://jira.company.com/browse/KAN-206"
        }
      ]
    },
    {
      "name": "Dev Active",
      "top_text": "WIP: 2",
      "order": 2,
      "sle": { "step1": 5, "step2": 10, "step3": 15, "step4": 20 },
      "items": [
         {
          "key": "KAN-301",
          "title": "API Integration",
          "type": "Story",
          "age": 8,
          "priority": "Medium",
          "urgency": 2,
          "assignee": { "name": "Diana", "picture": "", "link": "#" },
          "labels": ["Frontend"],
          "parent": { "key": "EPIC-3", "title": "Frontend Revamp", "url": "#" },
          "url": "https://jira.company.com/browse/KAN-301",
          "depends_on": "KAN-206",
          "label": "301"
        },
        {
          "key": "KAN-305",
          "title": "Performance Tuning",
          "type": "Task",
          "age": 22,
          "priority": "High",
          "urgency": 3,
          "assignee": { "name": "Evan", "picture": "", "link": "#" },
          "labels": ["Ops"],
          "parent": { "key": "EPIC-3", "title": "Frontend Revamp", "url": "#" },
          "url": "https://jira.company.com/browse/KAN-305"
        }
      ]
    },
    {
      "name": "Testing",
      "top_text": "WIP: 1",
      "order": 3,
      "sle": { "step1": 8, "step2": 12, "step3": 17, "step4": 25 },
      "items": [
        {
          "key": "KAN-101",
          "title": "Critical Fix",
          "type": "Bug",
          "age": 28,
          "priority": "Highest",
          "urgency": 4,
          "assignee": { "name": "Fiona", "picture": "", "link": "#" },
          "labels": ["Urgent"],
          "parent": { "key": "EPIC-9", "title": "Q3 Goals", "url": "#" },
          "url": "https://jira.company.com/browse/KAN-101",
          "depends_on": "KAN-305",
          "label": "101"
        }
      ]
    }
  ]
};

// --- Helper Functions ---

const getUniqueValues = (columns, field) => {
  const values = new Set();
  columns.forEach(col => {
    col.items.forEach(item => {
      if (field === 'label') {
        item.labels?.forEach(l => values.add(l));
      } else if (field === 'assignee') {
        if (item.assignee?.name) values.add(item.assignee.name);
      } else if (field === 'parent') {
        if (item.parent?.title) values.add(item.parent.title);
      } else if (item[field]) {
        values.add(item[field]);
      }
    });
  });
  return Array.from(values).sort();
};

const calculateLayout = (filteredColumns, maxDays) => {
  const layoutMap = new Map(); // itemId -> { x (global %), y (global %) }
  const totalCols = filteredColumns.length;
  const colWidthPct = 100 / totalCols;

  filteredColumns.forEach((col, colIndex) => {
    const items = col.items; 
    const count = items.length;
    const spread = 80; // 80% of column width
    const offset = 10; // 10% padding left

    items.forEach((item, itemIndex) => {
      let localXPct = 50;
      if (count > 1) {
        localXPct = offset + (itemIndex / (count - 1)) * spread;
      }
      const globalXPct = (colIndex * colWidthPct) + (localXPct * colWidthPct / 100);
      const effectiveAge = Math.min(item.age, maxDays);
      const globalYPct = (effectiveAge / maxDays) * 100;

      layoutMap.set(item.key, { x: globalXPct, y: globalYPct, item, localXPct });
    });
  });

  return layoutMap;
};

// --- Components ---

const SmartTooltip = ({ item, dependency, position, theme }) => {
  const tooltipRef = useRef(null);
  const [adjustedStyle, setAdjustedStyle] = useState({ 
    visibility: 'hidden', 
    left: 0, 
    top: 0 
  });

  useLayoutEffect(() => {
    if (!tooltipRef.current || !position) return;
    
    const tooltip = tooltipRef.current;
    const rect = tooltip.getBoundingClientRect();
    const { innerWidth } = window;
    
    let left = position.x;
    let top = position.y - 12; // 12px gap above dot
    
    const halfWidth = rect.width / 2;
    if (left - halfWidth < 10) left = halfWidth + 10; 
    else if (left + halfWidth > innerWidth - 10) left = innerWidth - halfWidth - 10;

    if (top - rect.height < 10) top = position.y + 24; 
    else top = top - rect.height;

    setAdjustedStyle({
      visibility: 'visible',
      left: left,
      top: top
    });

  }, [position]);

  if (!item || !position) return null;

  const priorityEmoji = theme.priorities[item.priority] || '';

  return (
    <div 
      ref={tooltipRef}
      className="fixed z-[9999] bg-white border border-slate-200 shadow-2xl rounded-lg p-3 w-72 pointer-events-none text-left transition-opacity duration-150"
      style={{ 
        left: adjustedStyle.left, 
        top: adjustedStyle.top,
        visibility: adjustedStyle.visibility,
        transform: 'translateX(-50%)' 
      }}
    >
      <div className="flex justify-between items-start mb-1">
        <span className="font-bold text-slate-800 text-sm">{item.key}</span>
        <span className="text-xs font-mono bg-slate-100 px-1 rounded text-slate-500">{item.age} days</span>
      </div>
      <p className="text-sm font-medium text-slate-700 leading-tight mb-2">{item.title}</p>
      
      {item.priority && (
        <div className="mb-2 pb-2 border-b border-slate-100">
           <div className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider flex items-center gap-1">
             Priority
           </div>
           <div className="text-xs text-slate-700 font-medium flex items-center gap-1">
             <span>{priorityEmoji}</span>
             <span>{item.priority}</span>
           </div>
        </div>
      )}

      {item.parent && (
        <div className="mb-2 pb-2 border-b border-slate-100">
           <div className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider flex items-center gap-1">
             Parent
           </div>
           <div className="text-xs text-blue-600 truncate font-medium">{item.parent.key} - {item.parent.title}</div>
        </div>
      )}

      {/* Dependency Info */}
      {dependency && (
        <div className="mb-2 pb-2 border-b border-slate-100">
           <div className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider flex items-center gap-1">
             <LinkIcon size={10} /> Depends on
           </div>
           <div className="text-xs text-amber-600 truncate font-medium">
             {dependency.key} - {dependency.title}
           </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1 mb-2">
        {item.labels.map(label => (
          <span key={label} className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full border border-blue-100">
            {label}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
        <div className="w-5 h-5 bg-indigo-100 rounded-full flex items-center justify-center text-[10px] text-indigo-700 font-bold overflow-hidden">
            {item.assignee.picture ? (
              <img src={item.assignee.picture} className="w-full h-full object-cover" alt={item.assignee.name} />
            ) : (
              <span>
                {item.assignee.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </span>
            )}
        </div>
        <span className="text-xs text-slate-500">{item.assignee.name}</span>
      </div>
    </div>
  );
};

const ItemDot = ({ layout, layoutMap, setTooltipData, theme }) => {
  const { item, localXPct, y } = layout;
  const [hovered, setHovered] = useState(false);

  const typeConfig = theme.types[item.type] || { color: "#6b7280", borderColor: "#4b5563", icon: "?" };
  const borderWidth = 1 + (item.urgency || 0) * 3;
  
  // Use item.label if defined, otherwise use type icon
  const displayText = item.label || typeConfig.icon;

  const handleMouseEnter = (e) => {
    setHovered(true);
    const rect = e.currentTarget.getBoundingClientRect();
    
    let dependencyItem = null;
    if (item.depends_on && layoutMap.has(item.depends_on)) {
      dependencyItem = layoutMap.get(item.depends_on).item;
    }

    setTooltipData({
      item: item,
      dependency: dependencyItem,
      position: { x: rect.left + rect.width / 2, y: rect.top }
    });
  };

  const handleMouseLeave = () => {
    setHovered(false);
    setTooltipData(null);
  };

  return (
    <div 
      className="absolute w-full h-0 pointer-events-none z-20"
      style={{ bottom: `${y}%` }}
    >
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group outline-none pointer-events-auto"
        style={{ left: `${localXPct}%` }} 
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div 
          className={`w-8 h-8 rounded-full shadow-sm flex items-center justify-center transition-transform duration-200 ${hovered ? 'scale-125 z-50' : 'scale-100 z-10'} relative`}
          style={{ 
            backgroundColor: typeConfig.color,
            borderWidth: `${borderWidth}px`,
            borderStyle: 'solid',
            borderColor: typeConfig.borderColor,
            filter: 'brightness(0.9)',
            boxSizing: 'content-box'
          }}
        >
           <span className="text-white text-[10px] font-bold">{displayText}</span>
        </div>
        {item.depends_on && (
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-slate-800 rounded-full border border-white" title="Has dependency"></div>
        )}
      </a>
    </div>
  );
};

const MultiSelect = ({ label, options, selectedValues = [], onChange, isOpen, onToggle, onClose }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const handleOptionClick = (option) => {
    const newValues = selectedValues.includes(option)
      ? selectedValues.filter(v => v !== option)
      : [...selectedValues, option];
    onChange(newValues);
  };

  const badgeCount = selectedValues.length;

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={onToggle}
        className={`flex items-center gap-2 text-sm border rounded-md px-3 py-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${isOpen || badgeCount > 0 ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
      >
        <span className="font-medium">{label}</span>
        {badgeCount > 0 && (
          <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem]">
            {badgeCount}
          </span>
        )}
        <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}/>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-56 bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden flex flex-col">
          <div className="max-h-64 overflow-y-auto py-1">
            {options.map((option) => {
              const isSelected = selectedValues.includes(option);
              return (
                <label 
                  key={option} 
                  className="flex items-center px-3 py-2 hover:bg-slate-50 cursor-pointer select-none transition-colors"
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center mr-3 transition-colors ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white'}`}>
                    {isSelected && <Check size={10} className="text-white" strokeWidth={4} />}
                  </div>
                  <input 
                    type="checkbox" 
                    className="hidden" 
                    checked={isSelected}
                    onChange={() => handleOptionClick(option)}
                  />
                  <span className={`text-sm ${isSelected ? 'text-slate-900 font-medium' : 'text-slate-600'}`}>{option}</span>
                </label>
              );
            })}
            {options.length === 0 && (
              <div className="px-3 py-2 text-sm text-slate-400 italic">No options available</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const FilterBar = ({ config, columns, activeFilters, onFilterChange, dependencyConfig, showArrows, setShowArrows }) => {
  const [openDropdown, setOpenDropdown] = useState(null);

  if (!config.enabled) return null;

  return (
    <div className="mb-4 p-4 bg-white border border-slate-200 rounded-lg flex flex-wrap gap-4 items-center">
      <div className="flex items-center gap-2 text-slate-500 mr-2">
        <Filter size={16} />
        <span className="text-sm font-semibold">Filters:</span>
      </div>

      {config.fields.map(field => {
        const options = getUniqueValues(columns, field);
        const label = field.charAt(0).toUpperCase() + field.slice(1);
        
        return (
          <MultiSelect
            key={field}
            label={label}
            options={options}
            selectedValues={activeFilters[field] || []}
            isOpen={openDropdown === field}
            onToggle={() => setOpenDropdown(openDropdown === field ? null : field)}
            onClose={() => setOpenDropdown(null)}
            onChange={(newValues) => onFilterChange(field, newValues)}
          />
        );
      })}

      {Object.keys(activeFilters).some(k => activeFilters[k]?.length > 0) && (
         <button 
           onClick={() => onFilterChange('reset')}
           className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium ml-auto px-2 py-1 hover:bg-red-50 rounded"
         >
           <X size={12} /> Clear Filters
         </button>
      )}

      {dependencyConfig.show_toggle && (
         <div className="flex items-center gap-2 ml-4 pl-4 border-l border-slate-200">
           <label className="flex items-center cursor-pointer relative">
             <input 
               type="checkbox" 
               name="show-dependencies"
               checked={showArrows} 
               onChange={() => setShowArrows(!showArrows)} 
               className="sr-only peer" 
             />
             <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
             <span className="ml-2 text-sm text-slate-600 font-medium flex items-center gap-1">
                Show Dependencies <ArrowRight size={14} className="text-slate-400"/>
             </span>
           </label>
         </div>
      )}
    </div>
  );
};

const getDataFromURL = () => {
  try {
    const params = new URLSearchParams(window.location.search);
    const dataParam = params.get('data');
    
    if (dataParam) {
      // Try Base64 decoding first (with UTF-8 support)
      try {
        const decoded = decodeURIComponent(escape(atob(dataParam)));
        return JSON.parse(decoded);
      } catch {
        // Fall back to URL decoding
        const decoded = decodeURIComponent(dataParam);
        return JSON.parse(decoded);
      }
    }
  } catch (error) {
    console.error('Error parsing data from URL:', error);
    console.warn('Falling back to mock data');
  }
  
  return null;
};

export default function App() {
  // Load data from URL or fall back to mock data
  const [data] = useState(() => getDataFromURL() || MOCK_DATA);

  const { title, subtitle, max_days, columns, board_url, features, theme } = data;
  const [tooltipData, setTooltipData] = useState(null);
  const [activeFilters, setActiveFilters] = useState({});
  const [showArrows, setShowArrows] = useState(features.dependencies.default_visible);

  // Inject data as HTML comment
  useEffect(() => {
    // Check if comment already exists
    const firstChild = document.documentElement.firstChild;
    if (firstChild?.nodeType === 8 && firstChild.nodeValue?.includes('DATA (JSON):')) {
      return; // Comment already exists
    }
    
    const prettyJson = JSON.stringify(data, null, 2);
    // Fix: Encode to UTF-8 bytes first, then base64
    const base64 = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
    const commentText = `\n${'='.repeat(80)}\nDATA (JSON):\n${'='.repeat(80)}\n${prettyJson}\n\n${'='.repeat(80)}\nDATA (BASE64):\n${'='.repeat(80)}\n${base64}\n${'='.repeat(80)}\n`;
    const comment = document.createComment(commentText);
    document.documentElement.insertBefore(comment, document.documentElement.firstChild);
  }, [data]);

  const filteredColumns = useMemo(() => {
    return columns.map(col => ({
      ...col,
      items: col.items.filter(item => {
        for (const [key, activeValues] of Object.entries(activeFilters)) {
          // Skip if no filters selected for this category
          if (!activeValues || activeValues.length === 0) continue;

          let hasMatch = false;

          if (key === 'assignee') {
            if (activeValues.includes(item.assignee?.name)) hasMatch = true;
          } else if (key === 'parent') {
             if (activeValues.includes(item.parent?.title)) hasMatch = true;
          } else if (key === 'label') {
            // Check if item has ANY of the selected labels
            if (item.labels?.some(l => activeValues.includes(l))) hasMatch = true;
          } else {
            // Generic check (type, priority, etc)
            if (activeValues.includes(item[key])) hasMatch = true;
          }

          if (!hasMatch) return false;
        }
        return true;
      }).sort((a, b) => a.key.localeCompare(b.key)) 
    }));
  }, [columns, activeFilters]);

  const layoutMap = useMemo(() => {
    return calculateLayout(filteredColumns, max_days);
  }, [filteredColumns, max_days]);

  const renderArrows = () => {
    if (!showArrows || !features.dependencies.enabled) return null;
    const { arrow_color = "#303030", arrow_thickness = 2 } = features.dependencies;
    
    // Dynamic refX calculation:
    // Dot Radius = 12px. Padding = 2px. Total dist = 14px.
    // markerUnits = strokeWidth.
    // refX units = distance / thickness.
    // markerWidth (10) + distance units.
    const markerRefX = 10 + (14 / arrow_thickness);

    const arrows = [];
    layoutMap.forEach((coords, key) => {
      const item = coords.item;
      if (item.depends_on && layoutMap.has(item.depends_on)) {
        const start = layoutMap.get(item.depends_on); 
        const end = coords; 
        const x1 = start.x;
        const y1 = 100 - start.y;
        const x2 = end.x;
        const y2 = 100 - end.y;

        arrows.push(
          <g key={`${start.item.key}-${end.item.key}`}>
             <line 
               x1={`${x1}%`} y1={`${y1}%`} 
               x2={`${x2}%`} y2={`${y2}%`} 
               stroke={arrow_color} 
               strokeWidth={arrow_thickness} 
               strokeDasharray="4 2"
               markerEnd="url(#arrowhead)"
               opacity="0.6"
             />
          </g>
        );
      }
    });

    return (
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <marker 
            id="arrowhead" 
            markerWidth="10" 
            markerHeight="7" 
            refX={markerRefX} 
            refY="3.5" 
            orient="auto"
            markerUnits="strokeWidth"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill={arrow_color} />
          </marker>
        </defs>
        {arrows}
      </svg>
    );
  };

  const handleFilterChange = (field, newValues) => {
    if (field === 'reset') {
      setActiveFilters({});
    } else {
      setActiveFilters(prev => ({ ...prev, [field]: newValues }));
    }
  };

  // Generate legend from theme types
  const typeLegend = Object.entries(theme.types).map(([typeName, config]) => (
    <div key={typeName} className="flex items-center gap-2 text-sm text-slate-600">
      <div 
        className="w-3 h-3 rounded flex items-center justify-center text-[8px]" 
        style={{ backgroundColor: config.color, color: 'white' }}
      >
        {config.icon}
      </div> 
      {typeName}
    </div>
  ));

  return (
    <div className="w-full min-h-screen bg-slate-50 p-8 font-sans relative">
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
          <p className="text-slate-500">{subtitle}</p>
        </div>
        <div className="flex gap-4 items-center">
            <a href={board_url} className="text-sm text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1">
              Go to Board <Info size={14} />
            </a>
        </div>
      </div>

      <FilterBar 
        config={features.filters} 
        columns={columns} 
        activeFilters={activeFilters}
        onFilterChange={handleFilterChange}
        dependencyConfig={features.dependencies}
        showArrows={showArrows}
        setShowArrows={setShowArrows}
      />

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 pl-12 relative overflow-hidden">
        <div className="absolute -left-4 top-1/2 transform -rotate-90 text-xs font-bold text-slate-400 tracking-wider">
          AGE (DAYS)
        </div>
        <div className="absolute left-0 top-[64px] bottom-[40px] w-12 border-r border-dashed border-slate-200">
           {Array.from({length: 6}).map((_, i) => {
              const tick = Math.round(i * (max_days / 5));
              return (
                 <div key={tick} className="absolute right-2 transform translate-y-1/2 text-xs text-slate-400 font-mono" style={{ bottom: `${(tick / max_days) * 100}%` }}>
                   {tick}
                 </div>
              );
           })}
        </div>

        {/* CRITICAL LAYOUT FIX:
          We need a scrolling container that ensures the SVG overlay AND the columns
          share the exact same 'scrollWidth'.
          Using 'w-max' or 'min-w-full' inside 'overflow-x-auto' ensures that if columns grow,
          the container grows, and the SVG (inset-0) grows with it.
        */}
        <div className="relative w-full overflow-x-auto" style={{ height: '500px' }}>
            <div className="relative min-w-full w-max h-full">
                
                {/* Layer 1: Columns (Backgrounds) - Z-0 */}
                <div className="flex w-full h-full relative z-0">
                    {filteredColumns
                        .sort((a, b) => a.order - b.order)
                        .map((col, colIndex) => (
                        <StatusColumn 
                            key={colIndex} 
                            columnData={col} 
                            maxDays={max_days} 
                            layoutMap={layoutMap}
                            setTooltipData={setTooltipData}
                            theme={theme}
                        />
                    ))}
                </div>

                {/* Layer 2: Arrows - Z-10 (Now inside the growing container) */}
                {renderArrows()}
            </div>
        </div>
      </div>

      <div className="mt-6 flex gap-6 justify-center flex-wrap">
        {typeLegend}
      </div>

      {/* Smart Tooltip (Fixed position, boundary aware) */}
      {tooltipData && (
        <SmartTooltip 
          item={tooltipData.item} 
          dependency={tooltipData.dependency}
          position={tooltipData.position}
          theme={theme}
        />
      )}
    </div>
  );
}

const StatusColumn = ({ columnData, maxDays, layoutMap, setTooltipData, theme }) => {
  const { name, top_text, sle, items } = columnData;
  
  // Build SLE zones dynamically based on theme colors and column SLE config
  const sleSteps = Object.keys(sle).sort((a, b) => {
    const numA = parseInt(a.replace('step', ''));
    const numB = parseInt(b.replace('step', ''));
    return numA - numB;
  });
  
  const zones = [];
  let prevValue = 0;
  
  sleSteps.forEach((step, index) => {
    const stepValue = sle[step];
    const colorIndex = index;
    const color = theme.sle_colors[colorIndex] || 'transparent';
    
    zones.push({
      start: prevValue,
      end: stepValue,
      color: color
    });
    
    prevValue = stepValue;
  });
  
  // Add final zone (from last step to max_days)
  const lastColorIndex = sleSteps.length;
  const lastColor = theme.sle_colors[lastColorIndex] || 'transparent';
  zones.push({
    start: prevValue,
    end: maxDays,
    color: lastColor,
    isTop: true
  });

  return (
    <div className="flex-1 flex flex-col min-w-[150px] border-r border-slate-200 last:border-r-0 relative z-0">
      <div className="h-16 border-b border-slate-200 bg-slate-50 p-2 flex flex-col items-center justify-center text-center z-10">
        <span className="text-xs text-slate-500 font-mono mb-1">{top_text}</span>
      </div>

      <div className="relative flex-1 w-full bg-slate-100 overflow-hidden">
        <div className="absolute inset-0 flex flex-col-reverse">
           {zones.map((zone, idx) => (
             <SLEZone 
               key={idx}
               start={zone.start} 
               end={zone.end} 
               maxDays={maxDays} 
               color={zone.color} 
               isTop={zone.isTop}
             />
           ))}
        </div>

        <div className="absolute inset-0 z-20">
             {items.map((item) => {
                const layout = layoutMap.get(item.key);
                if (!layout) return null;
                return (
                    <ItemDot 
                        key={item.key} 
                        layout={layout}
                        layoutMap={layoutMap}
                        setTooltipData={setTooltipData}
                        theme={theme}
                    />
                );
             })}
        </div>
      </div>
      <div className="h-10 border-t border-slate-200 bg-white flex items-center justify-center">
        <span className="font-semibold text-slate-700 text-sm">{name}</span>
      </div>
    </div>
  );
};

const SLEZone = ({ start, end, maxDays, color, isTop }) => {
  const effectiveEnd = end || maxDays;
  const heightPct = ((effectiveEnd - start) / maxDays) * 100;
  return (
    <div className="w-full relative border-b border-white/20 last:border-0" style={{ height: `${heightPct}%`, backgroundColor: color }}>
      {!isTop && <div className="absolute top-0 w-full border-t border-dashed border-slate-400/30"></div>}
    </div>
  );
};