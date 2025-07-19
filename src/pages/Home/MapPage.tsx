import { useEffect, useState, useRef } from "react";
import {
  MapPin,
  RefreshCw,
  Database,
  X,
  Zap,
  Map,
  Building,
  Navigation,
  Filter,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const TowerMapDashboard = () => {
  type TowerData = {
    id: string;
    unitName: string;
    latitude: number;
    longitude: number;
    towerType: string;
    voltage: number;
    operationYear: number;
    locationName: string;
    substation: string;
    region: string;
    status: string;
  };

  const [towers, setTowers] = useState<TowerData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [loadingProgress, setLoadingProgress] = useState("");
  const [selectedTower, setSelectedTower] = useState<TowerData | null>(null);
  const [filteredTowers, setFilteredTowers] = useState<TowerData[]>([]);

  // Filter states
  const [filterExpanded, setFilterExpanded] = useState(true);
  const [voltageFilter, setVoltageFilter] = useState<string>("");
  const [regionFilter, setRegionFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletLoadedRef = useRef(false);

  // Get API credentials from environment
  const apiKey = import.meta.env.VITE_API_LINK_KEY || "";
  const folderId = import.meta.env.VITE_API_LINK_ID || "";

  // Initialize Leaflet map
  useEffect(() => {
    const loadLeaflet = async () => {
      if (leafletLoadedRef.current && mapRef.current) {
        return;
      }

      if (!document.querySelector('link[href*="leaflet"]')) {
        const cssLink = document.createElement("link");
        cssLink.rel = "stylesheet";
        cssLink.href =
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css";
        document.head.appendChild(cssLink);
      }

      if (!(window as any).L) {
        const script = document.createElement("script");
        script.src =
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
        script.onload = () => {
          leafletLoadedRef.current = true;
          setTimeout(initMap, 100);
        };
        script.onerror = () => {
          setError("Failed to load Leaflet library");
        };
        document.head.appendChild(script);
      } else {
        leafletLoadedRef.current = true;
        initMap();
      }
    };

    const initMap = () => {
      const L = (window as any).L;
      if (!L || !mapContainerRef.current || mapRef.current) return;

      try {
        // Initialize map centered on Bekasi area (Indonesia coordinates)
        const mapInstance = L.map(mapContainerRef.current, {
          center: [-6.4, 107.17], // Bekasi, Indonesia
          zoom: 11,
          zoomControl: true,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap contributors",
          maxZoom: 18,
        }).addTo(mapInstance);

        mapRef.current = mapInstance;
      } catch (err) {
        console.error("Error initializing map:", err);
        setError("Failed to initialize map");
      }
    };

    loadLeaflet();

    return () => {
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (e) {
          console.warn("Error removing map:", e);
        }
        mapRef.current = null;
      }
    };
  }, []);

  // Apply filters
  useEffect(() => {
    let filtered = [...towers];

    // Search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(
        (tower) =>
          tower.locationName
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          tower.unitName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tower.substation.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tower.region.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Voltage filter
    if (voltageFilter) {
      filtered = filtered.filter((tower) => {
        const voltage = tower.voltage;
        switch (voltageFilter) {
          case "500+":
            return voltage >= 500;
          case "150-499":
            return voltage >= 150 && voltage < 500;
          case "70-149":
            return voltage >= 70 && voltage < 150;
          case "<70":
            return voltage < 70;
          default:
            return true;
        }
      });
    }

    // Region filter
    if (regionFilter) {
      filtered = filtered.filter((tower) =>
        tower.region.toLowerCase().includes(regionFilter.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter) {
      filtered = filtered.filter((tower) =>
        tower.status.toLowerCase().includes(statusFilter.toLowerCase())
      );
    }

    setFilteredTowers(filtered);
  }, [towers, searchQuery, voltageFilter, regionFilter, statusFilter]);

  // Update markers when filtered towers change
  useEffect(() => {
    if (!mapRef.current) return;

    const L = (window as any).L;
    if (!L) return;

    try {
      // Clear existing markers
      markersRef.current.forEach((marker) => {
        try {
          if (mapRef.current && marker) {
            mapRef.current.removeLayer(marker);
          }
        } catch (e) {
          console.warn("Error removing marker:", e);
        }
      });
      markersRef.current = [];

      if (filteredTowers.length === 0) return;

      // Create custom icon for towers
      const createTowerIcon = (voltage: number, towerType: string) => {
        const color = getMarkerColor(voltage);
        const size = getMarkerSize(voltage);
        console.log(towerType);
        return L.divIcon({
          html: `
            <div style="
              background-color: ${color};
              width: ${size}px;
              height: ${size}px;
              border-radius: 4px;
              border: 3px solid white;
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-weight: bold;
              font-size: ${size > 20 ? "12px" : "10px"};
            ">
              <span>⚡</span>
            </div>
          `,
          className: "custom-tower-marker",
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
      };

      // Add new markers
      const newMarkers: any[] = [];
      filteredTowers.forEach((tower) => {
        try {
          const marker = L.marker([tower.latitude, tower.longitude], {
            icon: createTowerIcon(tower.voltage, tower.towerType),
          });

          marker.on("click", () => {
            setSelectedTower(tower);
          });

          // Add tooltip on hover
          marker.bindTooltip(
            `
            <div style="padding: 8px;">
              <strong>${tower.locationName}</strong><br/>
              ${tower.voltage}kV ${tower.towerType}<br/>
              Substation: ${tower.substation}
            </div>
          `,
            {
              direction: "top",
              offset: [0, -10],
            }
          );

          marker.addTo(mapRef.current);
          newMarkers.push(marker);
        } catch (e) {
          console.warn("Error creating marker:", e);
        }
      });

      markersRef.current = newMarkers;

      // Fit map to show all markers
      if (filteredTowers.length > 0) {
        try {
          const validTowers = filteredTowers.filter(
            (tower) =>
              tower.latitude &&
              tower.longitude &&
              !isNaN(tower.latitude) &&
              !isNaN(tower.longitude) &&
              Math.abs(tower.latitude) > 0.1 && // Filter out zero coordinates
              Math.abs(tower.longitude) > 0.1
          );

          if (validTowers.length > 0) {
            const latLngs = validTowers.map((tower) => [
              tower.latitude,
              tower.longitude,
            ]);
            const bounds = L.latLngBounds(latLngs);

            if (bounds.isValid()) {
              mapRef.current.fitBounds(bounds, {
                padding: [20, 20],
                maxZoom: 13,
              });
            }
          }
        } catch (e) {
          console.warn("Error fitting bounds:", e);
        }
      }
    } catch (err) {
      console.error("Error updating markers:", err);
    }
  }, [filteredTowers]);

  // Get marker color based on voltage
  const getMarkerColor = (voltage: number): string => {
    if (voltage >= 500) return "#DC2626"; // Red for 500kV+
    if (voltage >= 150) return "#EA580C"; // Orange for 150kV+
    if (voltage >= 70) return "#CA8A04"; // Yellow for 70kV+
    return "#059669"; // Green for lower voltage
  };

  // Get marker size based on voltage
  const getMarkerSize = (voltage: number): number => {
    if (voltage >= 500) return 28;
    if (voltage >= 150) return 24;
    if (voltage >= 70) return 20;
    return 16;
  };

  // Helper function to find column by exact and partial match
  const findColumnValue = (row: any, possibleNames: string[]): string => {
    // First try exact matches
    for (const name of possibleNames) {
      if (
        row[name] !== undefined &&
        row[name] !== null &&
        String(row[name]).trim() !== ""
      ) {
        return String(row[name]).trim();
      }
    }

    // Then try partial matches (case-insensitive)
    for (const name of possibleNames) {
      for (const key of Object.keys(row)) {
        if (
          key.toLowerCase().includes(name.toLowerCase()) ||
          name.toLowerCase().includes(key.toLowerCase())
        ) {
          if (
            row[key] !== undefined &&
            row[key] !== null &&
            String(row[key]).trim() !== ""
          ) {
            return String(row[key]).trim();
          }
        }
      }
    }
    return "";
  };

  // Clean up long concatenated strings
  const cleanString = (value: string, maxLength: number = 50): string => {
    if (!value || typeof value !== "string") return "";

    // Remove extra commas and clean up
    let cleaned = value.replace(/,+/g, ",").replace(/^,|,$/g, "");

    // If it's a very long string with multiple values, try to extract the first meaningful part
    if (cleaned.length > maxLength && cleaned.includes(",")) {
      const parts = cleaned.split(",");
      // Try to find the most relevant part (usually the first non-empty meaningful part)
      for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed && trimmed.length > 3 && trimmed.length < maxLength) {
          return trimmed;
        }
      }
      return parts[0].trim();
    }

    return cleaned.length > maxLength
      ? cleaned.substring(0, maxLength) + "..."
      : cleaned;
  };

  // Parse CSV data with better handling
  const parseCSVData = (csvText: string): any[] => {
    const lines = csvText.split("\n").filter((line) => line.trim());
    if (lines.length < 2) return [];

    // Handle both tab and comma separators
    const firstLine = lines[0];
    const separator = firstLine.includes("\t") ? "\t" : ",";

    const headers = firstLine
      .split(separator)
      .map((h) => h.trim().replace(/"/g, ""));
    const data = [];

    console.log("Detected headers:", headers); // Debug log

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i]
        .split(separator)
        .map((v) => v.trim().replace(/"/g, ""));
      const row: any = {};

      headers.forEach((header, index) => {
        row[header] = values[index] || "";
      });

      data.push(row);
    }

    return data;
  };

  // Process Excel data with improved field mapping
  const processExcelData = (rawData: any[]): TowerData[] => {
    console.log("Processing raw data, sample row:", rawData[0]);
    console.log("Available columns:", Object.keys(rawData[0] || {}));

    return rawData
      .filter((row, index) => {
        // Find coordinates with more specific column names
        const lat = findColumnValue(row, [
          "LOCK LAT",
          "Latitude",
          "LAT",
          "Lock Lat",
        ]);
        const lng = findColumnValue(row, [
          "LOCK LONG",
          "LOCK LON",
          "Longitude",
          "LONG",
          "LON",
          "Lock Long",
        ]);
        const location = findColumnValue(row, [
          "Nama Lokasi",
          "NAMA LOKASI",
          "Location",
          "LOKASI",
        ]);

        const hasValidData = lat && lng && location;
        if (!hasValidData && index < 5) {
          console.log(
            `Row ${index} filtered out: lat=${lat}, lng=${lng}, location=${location}`
          );
        }
        return hasValidData;
      })
      .map((row, index) => {
        // Get values with improved column matching
        const latStr = findColumnValue(row, [
          "LOCK LAT",
          "Latitude",
          "LAT",
          "Lock Lat",
        ]);
        const lngStr = findColumnValue(row, [
          "LOCK LONG",
          "LOCK LON",
          "Longitude",
          "LONG",
          "LON",
          "Lock Long",
        ]);
        const location = findColumnValue(row, [
          "Nama Lokasi",
          "NAMA LOKASI",
          "Location",
          "LOKASI",
        ]);
        const voltage = findColumnValue(row, [
          "Tegangan",
          "TEGANGAN",
          "Voltage",
          "KV",
        ]);
        const towerType = findColumnValue(row, [
          "TIPE",
          "TIPE TOWER",
          "Type",
          "Tower Type",
        ]);
        const unit = findColumnValue(row, ["Unit", "UNIT", "Unit Name", "No"]);
        const substation = findColumnValue(row, [
          "Gardu Induk",
          "GARDU INDUK",
          "Substation",
          "GI",
        ]);
        const region = findColumnValue(row, [
          "KOTA/KAB",
          "KOTA",
          "Region",
          "Wilayah",
          "KAB",
          "KABUPATEN",
        ]);
        const status = findColumnValue(row, [
          "Status Operasi",
          "STATUS",
          "Status",
          "Operasi",
        ]);
        const functloc = findColumnValue(row, [
          "IdFunctloc",
          "FUNCTLOC",
          "ID",
          "Functloc",
        ]);

        // Parse coordinates more carefully
        const latitude = parseFloat(latStr.replace(",", ".")) || 0;
        const longitude = parseFloat(lngStr.replace(",", ".")) || 0;

        // Parse voltage more carefully
        const voltageNum = parseInt(voltage.replace(/[^0-9]/g, "")) || 0;

        const towerData = {
          id: functloc || `tower-${index}`,
          unitName: cleanString(unit || "Unknown Unit"),
          latitude,
          longitude,
          towerType: cleanString(towerType || "Unknown"),
          voltage: voltageNum,
          operationYear: 0,
          locationName: cleanString(location || "Unknown Location"),
          substation: cleanString(substation || "Unknown Substation", 80),
          region: cleanString(region || "Unknown Region"),
          status: cleanString(status || "Unknown Status"),
        };

        // Debug log for first few towers
        if (index < 5) {
          console.log(`Tower ${index}:`, {
            location: towerData.locationName,
            lat: towerData.latitude,
            lng: towerData.longitude,
            voltage: towerData.voltage,
            substation: towerData.substation.substring(0, 50) + "...",
          });
        }

        return towerData;
      })
      .filter((tower) => {
        // More stringent coordinate validation
        const isValidCoords =
          tower.latitude !== 0 &&
          tower.longitude !== 0 &&
          !isNaN(tower.latitude) &&
          !isNaN(tower.longitude) &&
          Math.abs(tower.latitude) > 0.1 &&
          Math.abs(tower.longitude) > 0.1 &&
          tower.latitude >= -90 &&
          tower.latitude <= 90 &&
          tower.longitude >= -180 &&
          tower.longitude <= 180;

        if (!isValidCoords) {
          console.log(
            `Invalid coordinates for ${tower.locationName}: lat=${tower.latitude}, lng=${tower.longitude}`
          );
        }
        return isValidCoords;
      });
  };

  // Download and parse Excel data
  const downloadAndParseExcel = async (fileId: string, fileName: string) => {
    try {
      setLoadingProgress(`Processing ${fileName}...`);

      // Try to export as CSV using Google Sheets API
      const csvResponse = await fetch(
        `https://docs.google.com/spreadsheets/d/${fileId}/export?format=csv&key=${apiKey}`
      );

      if (!csvResponse.ok) {
        throw new Error(
          `Failed to download ${fileName}: ${csvResponse.status}`
        );
      }

      const csvText = await csvResponse.text();
      console.log(`CSV sample for ${fileName}:`, csvText.substring(0, 500));

      const jsonData = parseCSVData(csvText);
      console.log(`Parsed ${jsonData.length} rows from ${fileName}`);
      if (jsonData.length > 0) {
        console.log(`Sample parsed row:`, jsonData[0]);
      }

      return processExcelData(jsonData);
    } catch (error: any) {
      console.error(`Error processing ${fileName}:`, error);
      throw error;
    }
  };

  // Fetch files from Google Drive
  const fetchGoogleDriveFiles = async () => {
    if (!apiKey || !folderId) {
      setError(
        "API Key and Folder ID must be configured in environment variables"
      );
      return;
    }

    setIsLoading(true);
    setError("");
    setLoadingProgress("Connecting to Google Drive...");

    try {
      // Test API access
      const testResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${folderId}?key=${apiKey}&fields=id,name`
      );

      if (!testResponse.ok) {
        const errorData = await testResponse.json();
        throw new Error(
          `API Test Failed (${testResponse.status}): ${
            errorData.error?.message || "Invalid API key or folder access"
          }`
        );
      }

      setLoadingProgress("Fetching Excel files list...");

      const query = encodeURIComponent(
        `'${folderId}' in parents and (name contains '.xlsx' or name contains '.xls')`
      );
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${query}&key=${apiKey}&fields=files(id,name,mimeType,size)`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `HTTP ${response.status}: ${
            errorData.error?.message || "Request failed"
          }`
        );
      }

      const result = await response.json();
      const excelFiles = result.files || [];

      if (excelFiles.length === 0) {
        setError("No Excel files found in the specified folder");
        setIsLoading(false);
        return;
      }

      setLoadingProgress(
        `Found ${excelFiles.length} Excel files. Processing...`
      );

      let allTowers: TowerData[] = [];

      for (let i = 0; i < excelFiles.length; i++) {
        const file = excelFiles[i];
        setLoadingProgress(
          `Processing ${file.name} (${i + 1}/${excelFiles.length})...`
        );

        try {
          const fileTowers = await downloadAndParseExcel(file.id, file.name);
          console.log(
            `Processed ${fileTowers.length} valid towers from ${file.name}`
          );
          allTowers = [...allTowers, ...fileTowers];
        } catch (error) {
          console.error(`Failed to process ${file.name}:`, error);
        }
      }

      console.log(`Total towers loaded: ${allTowers.length}`);
      setTowers(allTowers);
      setLoadingProgress("");

      if (allTowers.length === 0) {
        setError(
          "No valid tower data found in Excel files. Please check the console for debugging information and ensure your files have the correct coordinate columns (LOCK LAT, LOCK LONG)."
        );
      }
    } catch (error: any) {
      setError(`Error: ${error.message}`);
      setLoadingProgress("");
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-load data on component mount if API credentials are available
  useEffect(() => {
    if (apiKey && folderId) {
      fetchGoogleDriveFiles();
    }
  }, [apiKey, folderId]);

  // Get unique values for filters
  const getUniqueRegions = () =>
    [...new Set(towers.map((t) => t.region))].filter(Boolean).sort();
  const getUniqueStatuses = () =>
    [...new Set(towers.map((t) => t.status))].filter(Boolean).sort();

  // Get tower stats by voltage
  const getTowerStats = () => {
    const stats = {
      total: filteredTowers.length,
      "500+": filteredTowers.filter((t) => t.voltage >= 500).length,
      "150-499": filteredTowers.filter(
        (t) => t.voltage >= 150 && t.voltage < 500
      ).length,
      "70-149": filteredTowers.filter((t) => t.voltage >= 70 && t.voltage < 150)
        .length,
      "<70": filteredTowers.filter((t) => t.voltage < 70).length,
    };
    return stats;
  };

  const stats = getTowerStats();

  return (
    <div className="h-screen bg-gray-100 flex">
      {/* Left Sidebar - Filter Panel */}
      <div className="w-80 bg-white shadow-lg flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-teal-700 text-white p-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-bold">DATA ASSET UPT</h1>
            <div className="flex space-x-2">
              <span className="bg-yellow-500 text-black px-3 py-1 rounded text-sm font-bold">
                BEKASI
              </span>
              <span className="bg-yellow-400 text-black px-3 py-1 rounded text-sm font-bold">
                2025
              </span>
            </div>
          </div>

          <div className="flex space-x-2">
            <button
              className="bg-teal-700 text-white px-4 py-2 rounded text-sm font-semibold"
              onClick={() => {}}
            >
              DATA ASSET
            </button>
            <button className="text-teal-200 px-4 py-2 text-sm">
              PETA TOWER
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center">
              <Filter className="w-4 h-4 mr-2" />
              FILTERS
            </h3>
            <button
              onClick={() => setFilterExpanded(!filterExpanded)}
              className="text-gray-500 hover:text-gray-700"
            >
              {filterExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>

          {filterExpanded && (
            <div className="space-y-3">
              {/* Search */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Search
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search towers..."
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {/* Voltage Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Voltage Level
                </label>
                <select
                  value={voltageFilter}
                  onChange={(e) => setVoltageFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">All Voltages</option>
                  <option value="500+">500kV+ (SUTET)</option>
                  <option value="150-499">150-499kV</option>
                  <option value="70-149">70-149kV</option>
                  <option value="<70">Under 70kV</option>
                </select>
              </div>

              {/* Region Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Region
                </label>
                <select
                  value={regionFilter}
                  onChange={(e) => setRegionFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">All Regions</option>
                  {getUniqueRegions().map((region) => (
                    <option key={region} value={region}>
                      {region}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">All Status</option>
                  {getUniqueStatuses().map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              {/* Clear Filters */}
              <button
                onClick={() => {
                  setSearchQuery("");
                  setVoltageFilter("");
                  setRegionFilter("");
                  setStatusFilter("");
                }}
                className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-4 rounded text-sm font-medium transition-colors"
              >
                Clear All Filters
              </button>
            </div>
          )}
        </div>

        {/* Statistics */}
        <div className="p-4 flex-1 overflow-y-auto">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            TOWER STATISTICS
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
              <span className="text-sm text-blue-800">Total</span>
              <span className="font-bold text-blue-900">{stats.total}</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-red-50 rounded">
              <span className="text-sm text-red-800">SUTET (500kV+)</span>
              <span className="font-bold text-red-900">{stats["500+"]}</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-orange-50 rounded">
              <span className="text-sm text-orange-800">150-499kV</span>
              <span className="font-bold text-orange-900">
                {stats["150-499"]}
              </span>
            </div>
            <div className="flex justify-between items-center p-2 bg-yellow-50 rounded">
              <span className="text-sm text-yellow-800">70-149kV</span>
              <span className="font-bold text-yellow-900">
                {stats["70-149"]}
              </span>
            </div>
            <div className="flex justify-between items-center p-2 bg-green-50 rounded">
              <span className="text-sm text-green-800">Under 70kV</span>
              <span className="font-bold text-green-900">{stats["<70"]}</span>
            </div>
          </div>

          {/* Load Data Button */}
          <div className="mt-4">
            <button
              onClick={fetchGoogleDriveFiles}
              disabled={isLoading || !apiKey || !folderId}
              className="w-full flex items-center justify-center space-x-2 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-400 text-white px-4 py-2 rounded font-medium transition-colors"
            >
              <RefreshCw
                className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
              />
              <span>{isLoading ? "Loading..." : "Load Data"}</span>
            </button>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-sm mt-4">
              {error}
            </div>
          )}

          {loadingProgress && (
            <div className="bg-blue-100 border border-blue-400 text-blue-700 px-3 py-2 rounded text-sm mt-4">
              {loadingProgress}
            </div>
          )}
        </div>
      </div>

      {/* Main Content - Map */}
      <div className="flex-1 relative">
        <div ref={mapContainerRef} className="w-full h-full z-0"></div>

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-10">
            <div className="text-center">
              <RefreshCw className="w-16 h-16 text-teal-600 mx-auto mb-4 animate-spin" />
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                Loading Tower Data...
              </h3>
              <p className="text-gray-600">
                {loadingProgress || "Processing Excel files"}
              </p>
            </div>
          </div>
        )}

        {/* No Data Overlay */}
        {!isLoading && towers.length === 0 && (
          <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-10">
            <div className="text-center">
              <Database className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                No Tower Data Found
              </h3>
              <p className="text-gray-600 mb-4">
                Check browser console for debugging information
              </p>
              {(!apiKey || !folderId) && (
                <p className="text-red-600 text-sm">
                  Please configure VITE_API_LINK_KEY and VITE_API_LINK_ID in
                  your environment variables
                </p>
              )}
            </div>
          </div>
        )}

        {/* Legend */}
        {filteredTowers.length > 0 && (
          <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 z-20 max-w-xs">
            <h4 className="font-semibold text-gray-800 mb-3">Voltage Legend</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-red-600 rounded border-2 border-white shadow-md flex items-center justify-center text-white text-xs">
                  ⚡
                </div>
                <span>500kV+ (SUTET)</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-orange-600 rounded border-2 border-white shadow-md flex items-center justify-center text-white text-xs">
                  ⚡
                </div>
                <span>150-499kV</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-yellow-600 rounded border-2 border-white shadow-md flex items-center justify-center text-white text-xs">
                  ⚡
                </div>
                <span>70-149kV</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-green-600 rounded border-2 border-white shadow-md flex items-center justify-center text-white text-xs">
                  ⚡
                </div>
                <span>Under 70kV</span>
              </div>
              <div className="text-xs text-gray-500 mt-3">
                <div>• Larger markers = Higher voltage</div>
                <div>• Click markers for details</div>
                <div>
                  • Showing {filteredTowers.length} of {towers.length} towers
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tower Detail Modal */}
      {selectedTower && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-teal-600 to-teal-700 text-white p-6 relative">
              <button
                onClick={() => setSelectedTower(null)}
                className="absolute top-4 right-4 text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center space-x-3">
                <Building className="w-8 h-8" />
                <div>
                  <h3 className="text-xl font-bold">
                    {selectedTower.locationName}
                  </h3>
                  <p className="text-teal-100 text-sm">
                    {selectedTower.voltage}kV {selectedTower.towerType}
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              <div className="space-y-4">
                {/* Voltage */}
                <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Zap className="w-6 h-6 text-red-600" />
                    <div>
                      <p className="text-sm text-red-600 font-medium">
                        Voltage
                      </p>
                      <p className="text-lg font-bold text-red-800">
                        {selectedTower.voltage} kV
                      </p>
                    </div>
                  </div>
                </div>

                {/* Substation */}
                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Map className="w-6 h-6 text-blue-600" />
                    <div className="flex-1">
                      <p className="text-sm text-blue-600 font-medium">
                        Substation
                      </p>
                      <p className="text-sm font-bold text-blue-800 break-words">
                        {selectedTower.substation}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Region */}
                <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <MapPin className="w-6 h-6 text-green-600" />
                    <div>
                      <p className="text-sm text-green-600 font-medium">
                        Region
                      </p>
                      <p className="text-lg font-bold text-green-800">
                        {selectedTower.region}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Coordinates */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Navigation className="w-6 h-6 text-gray-600" />
                    <div>
                      <p className="text-sm text-gray-600 font-medium">
                        Coordinates
                      </p>
                      <p className="text-sm font-mono text-gray-800">
                        {selectedTower.latitude.toFixed(6)},{" "}
                        {selectedTower.longitude.toFixed(6)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Additional Info */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-purple-50 p-3 rounded-lg">
                    <p className="text-purple-600 font-medium">Unit</p>
                    <p className="text-purple-800 font-semibold">
                      {selectedTower.unitName}
                    </p>
                  </div>
                  <div className="bg-orange-50 p-3 rounded-lg">
                    <p className="text-orange-600 font-medium">Status</p>
                    <p className="text-orange-800 font-semibold">
                      {selectedTower.status}
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 flex space-x-3">
                <button
                  onClick={() => {
                    const googleMapsUrl = `https://www.google.com/maps?q=${selectedTower.latitude},${selectedTower.longitude}`;
                    window.open(googleMapsUrl, "_blank");
                  }}
                  className="flex-1 bg-teal-600 hover:bg-teal-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
                >
                  Open in Google Maps
                </button>
                <button
                  onClick={() => setSelectedTower(null)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-4 rounded-lg font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TowerMapDashboard;
