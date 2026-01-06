import React, { useState, useMemo, useRef, useLayoutEffect, useEffect } from 'react';
import { Info, Filter, ArrowRight, Link as LinkIcon, Check, ChevronDown, X, RefreshCw } from 'lucide-react';
import JiraPage from './JiraPage';

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
      "Task": { "color": "#3b82f6", "borderColor": "#2563eb", "borderWidth": 1, "icon": "TA" },
      "Bug": { "color": "#ef4444", "borderColor": "#dc2626", "borderWidth": 2, "icon": "BU" },
      "Story": { "color": "#10b981", "borderColor": "#059669", "borderWidth": 1, "icon": "US" }
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
      "sle": [2, 5, 7, 12],
      "items": [
        {
          "key": "KAN-202",
          "title": "Database Schema Review",
          "type": "Task",
          "age": 1,
          "priority": "High",
          "assignee": { "name": "Alice Dev", "picture": "https://i.pravatar.cc/150?img=10", "link": "#" },
          "labels": ["Backend", "DB"],
          "parent": { "key": "EPIC-1", "title": "Backend Overhaul", "url": "#" },
          "url": "https://jira.company.com/browse/KAN-202",
          "nickname": "202"
        },
        {
          "key": "KAN-205",
          "title": "Login Auth Bug",
          "type": "Bug",
          "age": 13,
          "priority": "Highest",
          "assignee": { "name": "Bob QA", "picture": "https://i.pravatar.cc/150?img=2", "link": "#" },
          "labels": ["Security"],
          "parent": { "key": "EPIC-2", "title": "Security Audit", "url": "#" },
          "url": "https://jira.company.com/browse/KAN-205",
          "depends_on": "KAN-202",
          "nickname": "205"
        },
        {
          "key": "KAN-206",
          "title": "Legacy Cleanup",
          "type": "Task",
          "age": 4,
          "priority": "Low",
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
      "sle": [5, 10, 15, 20],
      "items": [
         {
          "key": "KAN-301",
          "title": "API Integration",
          "type": "Story",
          "age": 8,
          "priority": "Medium",
          "assignee": { "name": "Diana", "picture": "", "link": "#" },
          "labels": ["Frontend"],
          "parent": { "key": "EPIC-3", "title": "Frontend Revamp", "url": "#" },
          "url": "https://jira.company.com/browse/KAN-301",
          "depends_on": "KAN-206",
          "nickname": "301"
        },
        {
          "key": "KAN-305",
          "title": "Performance Tuning",
          "type": "Task",
          "age": 22,
          "priority": "High",
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
      "sle": [8, 12, 17, 25],
      "items": [
        {
          "key": "KAN-101",
          "title": "Critical Fix",
          "type": "Bug",
          "age": 28,
          "priority": "Highest",
          "assignee": { "name": "Fiona", "picture": "", "link": "#" },
          "labels": ["Urgent"],
          "parent": { "key": "EPIC-9", "title": "Q3 Goals", "url": "#" },
          "url": "https://jira.company.com/browse/KAN-101",
          "depends_on": "KAN-305",
          "nickname": "101"
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

const SmartTooltip = ({ item, dependency, position, theme, isPinned, onTogglePin, onUpdatePosition, useTypeColor, sleColor, columnName }) => {
  const tooltipRef = useRef(null);
  const [adjustedStyle, setAdjustedStyle] = useState({ 
    visibility: 'hidden', 
    left: 0, 
    top: 0 
  });
  const [isHoveringTooltip, setIsHoveringTooltip] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);

  // Handle P key for pinning/unpinning when hovering tooltip
  useEffect(() => {
    if (!isHoveringTooltip) return;
    
    const handleKeyDown = (e) => {
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        onTogglePin(item.key);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isHoveringTooltip, onTogglePin, item.key]);

  // Handle dragging
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      if (!dragStart || !isPinned) return;
      
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      
      if (onUpdatePosition) {
        onUpdatePosition(item.key, {
          x: dragStart.posX + deltaX,
          y: dragStart.posY + deltaY
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setDragStart(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart, isPinned, onUpdatePosition, item.key]);

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
  
  // Get color based on toggle - either type color or SLE color
  let cardColor;
  if (useTypeColor) {
    const typeConfig = theme.types[item.type] || { color: "#6b7280" };
    cardColor = item.color || typeConfig.color;
  } else {
    cardColor = sleColor || "#6b7280";
  }
  
  // Convert hex to rgba with low opacity for light shade
  const hexToRgba = (hex, alpha = 1) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };
  
  const headerBgColor = hexToRgba(cardColor, 0.6);
  const borderColor = hexToRgba(cardColor, 1);

  return (
    <div 
      ref={tooltipRef}
      className="bg-white border border-slate-200 shadow-2xl rounded-lg overflow-hidden w-72 text-left transition-opacity duration-150"
      style={{ 
        position: isPinned ? 'absolute' : 'fixed',
        left: adjustedStyle.left, 
        top: adjustedStyle.top,
        visibility: adjustedStyle.visibility,
        transform: 'translateX(-50%)',
        pointerEvents: isPinned ? 'auto' : 'none',
        zIndex: 9999
      }}
      onMouseEnter={() => setIsHoveringTooltip(true)}
      onMouseLeave={() => setIsHoveringTooltip(false)}
    >
      {/* Draggable Header */}
      <div 
        className="border-b px-3 py-2 flex items-center justify-between select-none"
        style={{ 
          cursor: isPinned ? 'grab' : 'default',
          backgroundColor: headerBgColor,
          borderColor: borderColor
        }}
        onMouseDown={(e) => {
          if (!isPinned) return;
          e.preventDefault();
          setIsDragging(true);
          setDragStart({
            x: e.clientX,
            y: e.clientY,
            posX: position.x,
            posY: position.y
          });
        }}
      >
        <div className="flex items-center justify-between w-full gap-2">
          <span className="font-bold text-slate-800 text-sm">{item.key}</span>
          
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs font-mono bg-white px-2 py-0.5 rounded text-slate-600 border border-slate-300">
              {item.age_in_current_state !== undefined && item.age_in_current_state !== item.age
                ? `${item.age_in_current_state} of ${item.age}d`
                : `${item.age}d`}
            </span>
            
            {/* Close button for pinned cards */}
            {isPinned && (
              <button
                className="w-6 h-6 bg-slate-300 rounded flex items-center justify-center text-slate-700 font-bold text-xs border border-slate-400 hover:bg-slate-400 transition-colors"
                title="Close pinned card"
                onClick={(e) => {
                  e.stopPropagation();
                  onTogglePin(item.key);
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Card Body - Not draggable, links and text selectable */}
      <div className="p-3">
      <p className="text-sm font-medium text-slate-700 leading-tight mb-2">{item.title}</p>
      
      {/* Status and Priority in 2-column layout */}
      <div className="mb-2 pb-2 border-b border-slate-100 grid grid-cols-2 gap-3">
        {/* Status column */}
        <div>
          <div className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider flex items-center gap-1">
            Status
          </div>
          <div className="text-xs text-slate-700 font-medium">
            {columnName || 'Unknown'}
          </div>
        </div>
        
        {/* Priority column */}
        {item.priority && (
          <div>
            <div className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider flex items-center gap-1">
              Priority
            </div>
            <div className="text-xs text-slate-700 font-medium flex items-center gap-1">
              <span>{priorityEmoji}</span>
              <span>{item.priority}</span>
            </div>
          </div>
        )}
      </div>

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
    </div>
  );
};

const ItemDot = ({ layout, layoutMap, setTooltipData, theme, onTogglePin }) => {
  const { item, localXPct, y } = layout;
  const [hovered, setHovered] = useState(false);

  // Handle P key for pinning when hovering item
  useEffect(() => {
    if (!hovered) return;
    
    const handleKeyDown = (e) => {
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        onTogglePin(item.key);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hovered, onTogglePin, item.key]);

  // Get theme config for the type
  const typeConfig = theme.types[item.type] || { 
    color: "#6b7280", 
    borderColor: "#4b5563", 
    borderWidth: 2,
    icon: "?" 
  };

  // Allow item-level overrides
  const color = item.color || typeConfig.color;
  const borderColor = item.borderColor || typeConfig.borderColor;
  const borderWidth = item.borderWidth !== undefined ? item.borderWidth : typeConfig.borderWidth;
  const icon = item.icon || typeConfig.icon;
  
  // Use item.nickname if defined, otherwise use the icon
  const displayText = item.nickname || icon;

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
            backgroundColor: color,
            borderWidth: `${borderWidth}px`,
            borderStyle: 'solid',
            borderColor: borderColor,
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

const FilterBar = ({ config, columns, activeFilters, onFilterChange, dependencyConfig, showArrows, setShowArrows, showSLEZones, setShowSLEZones, showSLEValues, setShowSLEValues, useTypeColorForCards, setUseTypeColorForCards }) => {
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

      <div className="flex items-center gap-2 ml-4 pl-4 border-l border-slate-200">
        <label className="flex items-center cursor-pointer relative">
          <input 
            type="checkbox" 
            name="show-sle-zones"
            checked={showSLEZones} 
            onChange={() => setShowSLEZones(!showSLEZones)} 
            className="sr-only peer" 
          />
          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
          <span className="ml-2 text-sm text-slate-600 font-medium">
            Show SLE Zones
          </span>
        </label>
        
        <label className="flex items-center cursor-pointer relative ml-4">
          <input 
            type="checkbox" 
            name="show-sle-values"
            checked={showSLEValues} 
            onChange={() => setShowSLEValues(!showSLEValues)} 
            className="sr-only peer" 
          />
          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
          <span className="ml-2 text-sm text-slate-600 font-medium">
            Show SLE Values
          </span>
        </label>
      </div>

      <div className="flex items-center gap-2 ml-4 pl-4 border-l border-slate-200">
        <label className="flex items-center cursor-pointer relative">
          <input 
            type="checkbox" 
            name="use-type-color-for-cards"
            checked={useTypeColorForCards} 
            onChange={() => setUseTypeColorForCards(!useTypeColorForCards)} 
            className="sr-only peer" 
          />
          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
          <span className="ml-2 text-sm text-slate-600 font-medium">
            Card Color: {useTypeColorForCards ? 'Type' : 'SLE'}
          </span>
        </label>
      </div>
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
  const [currentRoute, setCurrentRoute] = useState(() => {
    const path = window.location.pathname;
    return path;
  });

  useEffect(() => {
    const handleNavigation = () => {
      setCurrentRoute(window.location.pathname);
    };
    
    window.addEventListener('popstate', handleNavigation);
    
    // Handle link clicks
    const handleClick = (e) => {
      if (e.target.tagName === 'A' && e.target.href.startsWith(window.location.origin)) {
        e.preventDefault();
        const path = new URL(e.target.href).pathname;
        window.history.pushState({}, '', path);
        setCurrentRoute(path);
      }
    };
    document.addEventListener('click', handleClick);
    
    return () => {
      window.removeEventListener('popstate', handleNavigation);
      document.removeEventListener('click', handleClick);
    };
  }, []);

  // Load data from URL or fall back to localStorage or mock data
  const [data, setData] = useState(() => {
    // First try URL parameter
    const urlData = getDataFromURL();
    if (urlData) return urlData;
    
    // Then try generated chart data from localStorage
    const generatedData = localStorage.getItem('generatedChartData');
    if (generatedData) {
      try {
        return JSON.parse(generatedData);
      } catch (e) {
        console.error('Failed to parse generated chart data:', e);
      }
    }
    
    // Fall back to mock data
    return MOCK_DATA;
  });
  
  const [jsonInput, setJsonInput] = useState(() => JSON.stringify(data, null, 2));
  const [jsonError, setJsonError] = useState(null);
  const [columnWidths, setColumnWidths] = useState({}); // Track width multiplier per column

  const { title, subtitle, max_days, columns, board_url, features, theme } = data;
  const [tooltipData, setTooltipData] = useState(null);
  const [pinnedItems, setPinnedItems] = useState(() => {
    try {
      const stored = localStorage.getItem('pinnedItems');
      if (stored) {
        const parsed = JSON.parse(stored);
        return new Map(Object.entries(parsed));
      }
    } catch (e) {
      console.error('Failed to load pinned items:', e);
    }
    return new Map();
  }); // Map<itemKey, {item, dependency, position}>
  const [activeFilters, setActiveFilters] = useState({});
  const [showArrows, setShowArrows] = useState(features.dependencies.default_visible);
  const [showSLEZones, setShowSLEZones] = useState(true);
  const [showSLEValues, setShowSLEValues] = useState(true);
  const [useTypeColorForCards, setUseTypeColorForCards] = useState(true);

  // Save pinned items to localStorage
  useEffect(() => {
    try {
      const obj = Object.fromEntries(pinnedItems);
      localStorage.setItem('pinnedItems', JSON.stringify(obj));
    } catch (e) {
      console.error('Failed to save pinned items:', e);
    }
  }, [pinnedItems]);

  const handleChartGenerated = (chartData) => {
    setData(chartData);
    setJsonInput(JSON.stringify(chartData, null, 2));
  };

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
    return calculateLayoutWithWidths(filteredColumns, max_days, columnWidths);
  }, [filteredColumns, max_days, columnWidths]);

  // ESC key to clear all pinned cards, O key to pin all visible items
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (pinnedItems.size > 0) {
          e.preventDefault();
          setPinnedItems(new Map());
        }
      } else if (e.key === 'o' || e.key === 'O') {
        // O key: clear current pins and pin all visible items
        e.preventDefault();
        
        // Get all visible items from layoutMap
        const newPinnedItems = new Map();
        layoutMap.forEach((coords, key) => {
          const item = coords.item;
          
          // Find dependency if exists
          let dependencyItem = null;
          if (item.depends_on && layoutMap.has(item.depends_on)) {
            dependencyItem = layoutMap.get(item.depends_on).item;
          }
          
          // Convert percentage coordinates to pixel position
          // layoutMap contains percentages, we need absolute pixel positions
          const chartContainer = document.querySelector('.bg-white.border.border-slate-200.rounded-xl');
          if (chartContainer) {
            const rect = chartContainer.getBoundingClientRect();
            const scrollY = window.scrollY || window.pageYOffset;
            const scrollX = window.scrollX || window.pageXOffset;
            
            // Calculate pixel position from percentage
            const pixelX = rect.left + (coords.x / 100) * rect.width;
            const pixelY = rect.top + ((100 - coords.y) / 100) * rect.height;
            
            newPinnedItems.set(key, {
              item: item,
              dependency: dependencyItem,
              position: {
                x: pixelX + scrollX,
                y: pixelY + scrollY
              }
            });
          }
        });
        
        setPinnedItems(newPinnedItems);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pinnedItems, layoutMap]);

  const handleColumnClick = (columnName) => {
    setColumnWidths(prev => {
      const currentWidth = prev[columnName] || 1;
      const nextWidth = currentWidth >= 4 ? 1 : currentWidth + 1;
      return { ...prev, [columnName]: nextWidth };
    });
  };

  const renderArrows = () => {
    if (!showArrows || !features.dependencies.enabled) return null;
    const { arrow_color = "#303030", arrow_thickness = 2 } = features.dependencies;
    
    // Dynamic refX calculation:
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

  const pinItem = (itemKey, itemData) => {
    setPinnedItems(prev => {
      const newMap = new Map(prev);
      // Calculate absolute position by adding scroll offset
      const scrollY = window.scrollY || window.pageYOffset;
      const scrollX = window.scrollX || window.pageXOffset;
      newMap.set(itemKey, {
        item: itemData.item,
        dependency: itemData.dependency,
        position: {
          x: itemData.position.x + scrollX,
          y: itemData.position.y + scrollY
        }
      });
      return newMap;
    });
  };

  const unpinItem = (itemKey) => {
    setPinnedItems(prev => {
      const newMap = new Map(prev);
      newMap.delete(itemKey);
      return newMap;
    });
  };

  const togglePin = (itemKey) => {
    setPinnedItems(prev => {
      const newMap = new Map(prev);
      if (newMap.has(itemKey)) {
        newMap.delete(itemKey);
      } else if (tooltipData && tooltipData.item.key === itemKey) {
        const scrollY = window.scrollY || window.pageYOffset;
        const scrollX = window.scrollX || window.pageXOffset;
        newMap.set(itemKey, {
          item: tooltipData.item,
          dependency: tooltipData.dependency,
          position: {
            x: tooltipData.position.x + scrollX,
            y: tooltipData.position.y + scrollY
          }
        });
      }
      return newMap;
    });
  };

  // Helper function to get SLE color for an item based on age
  const getSLEColorForItem = (item, columnData) => {
    if (!columnData.sle || !Array.isArray(columnData.sle)) {
      return theme.sle_colors[0] || '#86efac';
    }
    
    const age = item.age;
    const sle = columnData.sle;
    
    // Find which zone the item falls into
    for (let i = 0; i < sle.length; i++) {
      if (age <= sle[i]) {
        return theme.sle_colors[i] || '#86efac';
      }
    }
    
    // If age exceeds all SLE values, use last color
    return theme.sle_colors[sle.length] || theme.sle_colors[theme.sle_colors.length - 1] || '#fca5a5';
  };

  const updatePinnedPosition = (itemKey, newPosition) => {
    setPinnedItems(prev => {
      if (!prev.has(itemKey)) return prev;
      const newMap = new Map(prev);
      newMap.set(itemKey, {
        ...prev.get(itemKey),
        position: newPosition
      });
      return newMap;
    });
  };

  const handleApplyJson = () => {
    try {
      const parsedData = JSON.parse(jsonInput);
      setData(parsedData);
      setJsonError(null);
      // Reset filters and column widths when data changes
      setActiveFilters({});
      setColumnWidths({});
      setPinnedItems(new Map());
      setShowArrows(parsedData.features.dependencies.default_visible);
      setShowSLEZones(true);
      setShowSLEValues(true);
      setUseTypeColorForCards(true);
    } catch (error) {
      setJsonError(`Invalid JSON: ${error.message}`);
    }
  };

  // Generate legend from theme types
  const typeLegend = Object.entries(theme.types).map(([typeName, config]) => (
    <div key={typeName} className="flex items-center gap-3 text-base text-slate-700">
      <div 
        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-sm" 
        style={{ 
          backgroundColor: config.color, 
          borderWidth: `${config.borderWidth || 2}px`,
          borderStyle: 'solid',
          borderColor: config.borderColor || config.color,
          color: 'white' 
        }}
      >
        {config.icon}
      </div> 
      <span className="font-medium">{typeName}</span>
    </div>
  ));

  if (currentRoute === '/config') {
    return <JiraPage onChartGenerated={handleChartGenerated} />;
  }

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
            <a href="/config" className="text-sm text-green-600 hover:text-green-800 hover:underline flex items-center gap-1">
              Jira Config
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
        showSLEZones={showSLEZones}
        setShowSLEZones={setShowSLEZones}
        showSLEValues={showSLEValues}
        setShowSLEValues={setShowSLEValues}
        useTypeColorForCards={useTypeColorForCards}
        setUseTypeColorForCards={setUseTypeColorForCards}
      />

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 pl-12 relative">
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

        {/* CHART HEIGHT: Doubled from 500px to 1000px */}
        <div className="relative w-full overflow-x-auto overflow-y-visible" style={{ height: '1000px' }}>
            <div className="relative min-w-full w-max h-full overflow-visible">
                
                {/* Layer 1: Columns (Backgrounds) - Z-0 */}
                <div className="flex w-full h-full relative z-0 overflow-visible">
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
                            widthMultiplier={columnWidths[col.name] || 1}
                            onColumnClick={() => handleColumnClick(col.name)}
                            showSLEZones={showSLEZones}
                            showSLEValues={showSLEValues}
                            togglePin={togglePin}
                        />
                    ))}
                </div>

                {/* Layer 2: Arrows - Z-10 */}
                {renderArrows()}
            </div>
        </div>
      </div>

      <div className="mt-8 flex gap-8 justify-center flex-wrap">
        {typeLegend}
      </div>

      {/* JSON Editor Section */}
      <div className="mt-8 bg-white border border-slate-200 rounded-xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-slate-800">Data Editor</h2>
          <button
            onClick={handleApplyJson}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium text-sm"
          >
            <RefreshCw size={16} />
            Apply Changes
          </button>
        </div>

        {jsonError && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
            <strong>Error:</strong> {jsonError}
          </div>
        )}

        <textarea
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          className="w-full h-96 p-3 font-mono text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
          spellCheck="false"
          placeholder="Paste your JSON data here..."
        />

        <div className="mt-2 text-xs text-slate-500">
          Tip: Edit the JSON above and click "Apply Changes" to see your modifications reflected in the chart.
        </div>
      </div>

      {/* Smart Tooltips - Multiple independent instances */}
      {/* Render all pinned tooltips */}
      {Array.from(pinnedItems.entries()).map(([itemKey, pinnedData]) => {
        // Find column for this item to get SLE data
        const itemColumn = columns.find(col => col.items.some(i => i.key === itemKey));
        const sleColor = itemColumn ? getSLEColorForItem(pinnedData.item, itemColumn) : null;
        
        return (
          <SmartTooltip 
            key={`pinned-${itemKey}`}
            item={pinnedData.item} 
            dependency={pinnedData.dependency}
            position={pinnedData.position}
            theme={theme}
            isPinned={true}
            onTogglePin={togglePin}
            onUpdatePosition={updatePinnedPosition}
            useTypeColor={useTypeColorForCards}
            sleColor={sleColor}
            columnName={itemColumn?.name}
          />
        );
      })}
      
      {/* Render hover tooltip if item is not pinned */}
      {tooltipData && !pinnedItems.has(tooltipData.item.key) && (
        <SmartTooltip 
          key={`hover-${tooltipData.item.key}`}
          item={tooltipData.item} 
          dependency={tooltipData.dependency}
          position={tooltipData.position}
          theme={theme}
          isPinned={false}
          onTogglePin={togglePin}
          onUpdatePosition={updatePinnedPosition}
          useTypeColor={useTypeColorForCards}
          sleColor={(() => {
            const itemColumn = columns.find(col => col.items.some(i => i.key === tooltipData.item.key));
            return itemColumn ? getSLEColorForItem(tooltipData.item, itemColumn) : null;
          })()}
          columnName={(() => {
            const itemColumn = columns.find(col => col.items.some(i => i.key === tooltipData.item.key));
            return itemColumn?.name;
          })()}
        />
      )}
    </div>
  );
};

// Updated calculateLayout to support dynamic column widths
const calculateLayoutWithWidths = (filteredColumns, maxDays, columnWidths) => {
  const layoutMap = new Map();
  
  // Calculate total width units
  let totalWidthUnits = 0;
  filteredColumns.forEach(col => {
    const multiplier = columnWidths[col.name] || 1;
    totalWidthUnits += multiplier;
  });

  let currentXOffset = 0;

  filteredColumns.forEach((col) => {
    const multiplier = columnWidths[col.name] || 1;
    const colWidthPct = (multiplier / totalWidthUnits) * 100;
    
    const items = col.items;
    const count = items.length;
    const spread = 80; // 80% of column width
    const offset = 10; // 10% padding left

    items.forEach((item, itemIndex) => {
      let localXPct = 50;
      if (count > 1) {
        localXPct = offset + (itemIndex / (count - 1)) * spread;
      }
      const globalXPct = currentXOffset + (localXPct * colWidthPct / 100);
      const effectiveAge = Math.min(item.age, maxDays);
      const globalYPct = (effectiveAge / maxDays) * 100;

      layoutMap.set(item.key, { x: globalXPct, y: globalYPct, item, localXPct });
    });

    currentXOffset += colWidthPct;
  });

  return layoutMap;
};

const StatusColumn = ({ columnData, maxDays, layoutMap, setTooltipData, theme, widthMultiplier = 1, onColumnClick, showSLEZones = true, showSLEValues = true, togglePin }) => {
  const { name, top_text, bottom_text, sle, items } = columnData;
  const [isHovered, setIsHovered] = useState(false);
  
  // Build SLE zones and percentile markers based on sle format
  const zones = [];
  const percentileMarkers = [];
  const defaultPercentiles = [50, 75, 85, 90];
  
  if (sle && Array.isArray(sle) && sle.length > 0) {
    // New format: sle is an array of values [7, 12, 14, 15]
    let prevValue = 0;
    
    sle.forEach((stepValue, index) => {
      const color = theme.sle_colors[index] || 'transparent';
      
      zones.push({
        start: prevValue,
        end: stepValue,
        color: color
      });
      
      // Add percentile marker for this boundary
      percentileMarkers.push({
        percentile: defaultPercentiles[index] || (index * 10 + 50),
        days: stepValue,
        color: color,
        yPosition: (stepValue / maxDays) * 100
      });
      
      prevValue = stepValue;
    });
    
    // Add final zone (from last step to max_days)
    const lastColorIndex = sle.length;
    const lastColor = theme.sle_colors[lastColorIndex] || 'transparent';
    zones.push({
      start: prevValue,
      end: maxDays,
      color: lastColor,
      isTop: true
    });
  } else {
    // No SLE data - single zone with neutral background
    zones.push({
      start: 0,
      end: maxDays,
      color: '#f1f5f9', // slate-100
      isTop: true
    });
  }

  // Base width 225px * multiplier
  const baseWidth = 225;
  const width = baseWidth * widthMultiplier;

  // Format column name with angle brackets based on width multiplier
  const formatColumnName = (name, multiplier) => {
    if (multiplier === 1) return name;
    const brackets = '<'.repeat(multiplier - 1);
    const closeBrackets = '>'.repeat(multiplier - 1);
    return `${brackets} ${name} ${closeBrackets}`;
  };

  return (
    <div 
      className="flex-1 flex flex-col border-r border-slate-200 last:border-r-0 relative z-0 transition-all duration-300"
      style={{ minWidth: `${width}px`, flexBasis: `${width}px` }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="h-16 border-b border-slate-200 bg-slate-50 p-2 flex flex-col items-center justify-center text-center z-10">
        <span className="font-semibold text-slate-700 text-sm">
          {formatColumnName(name, widthMultiplier)} ({items.length})
        </span>
        {top_text && (
          <span className="text-xs text-slate-500 font-mono">{top_text}</span>
        )}
      </div>

      <div className="relative flex-1 w-full bg-slate-100 overflow-visible">
        {showSLEZones && (
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
        )}

        {/* Percentile markers - only visible on hover and when enabled */}
        {showSLEValues && isHovered && percentileMarkers.length > 0 && (
          <div className="absolute top-0 bottom-0 left-0 right-0 pointer-events-none z-50" style={{ overflow: 'visible' }}>
            {percentileMarkers.map((marker, idx) => (
              <PercentileMarker 
                key={idx}
                percentile={marker.percentile}
                days={marker.days}
                color={marker.color}
                yPosition={marker.yPosition}
              />
            ))}
          </div>
        )}

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
                        onTogglePin={togglePin}
                    />
                );
             })}
        </div>
      </div>
      
      <button
        onClick={onColumnClick}
        className="h-auto min-h-10 border-t border-slate-200 bg-white hover:bg-blue-50 flex flex-col items-center justify-center transition-colors cursor-pointer group py-2"
      >
        <span className="font-semibold text-slate-700 text-sm group-hover:text-blue-600 transition-colors">
          {formatColumnName(name, widthMultiplier)} ({items.length})
        </span>
        {bottom_text && (
          <span className="text-xs text-slate-500 font-mono mt-1">{bottom_text}</span>
        )}
      </button>
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

const PercentileMarker = ({ percentile, days, color, yPosition }) => {
  // Lighten the color for the label background (add transparency)
  const lightenColor = (hexColor) => {
    // If color has transparency or is not a hex, return with opacity
    if (!hexColor || hexColor === 'transparent') return 'rgba(200, 200, 200, 0.9)';
    return hexColor + 'E6'; // Add ~90% opacity
  };

  return (
    <div 
      className="absolute w-full h-0 pointer-events-none"
      style={{ bottom: `${yPosition}%` }}
    >
      {/* Horizontal line across the column */}
      <div className="absolute left-0 right-0 border-t border-black" style={{ borderWidth: '1px' }}></div>
      
      {/* Label in the center of the column */}
      <div 
        className="absolute px-2 py-1 rounded text-xs font-medium whitespace-nowrap shadow-sm border border-black"
        style={{ 
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: lightenColor(color),
          color: '#000'
        }}
      >
        {percentile}% - {days}d
      </div>
    </div>
  );
};