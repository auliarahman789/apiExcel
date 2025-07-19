import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import {
  RefreshCw,
  Folder,
  BarChart3,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  Database,
  Hash,
  Type,
  DollarSign,
  Tag,
  Map,
} from "lucide-react";
import * as XLSX from "xlsx";

const SimpleExcelDashboard = () => {
  type DataItem = {
    [key: string]: string | number | boolean | undefined;
  };

  type FieldInfo = {
    name: string;
    type: "number" | "currency" | "category" | "text";
    isMetric: boolean;
    isDimension: boolean;
    uniqueValues: number;
    sampleValues: string[];
    total?: number;
    average?: number;
    min?: number;
    max?: number;
  };

  type FileData = {
    id: string;
    name: string;
    data: DataItem[];
    fields: FieldInfo[];
    chart: ChartConfig | null;
    totalRows: number;
    totalColumns: number;
    fileSize?: string;
  };

  interface ChartConfig {
    type: "bar";
    title: string;
    xAxis: string;
    yAxis: string;
    data: any[];
    id: string;
    fileId: string;
    dataTotal: number;
  }

  const [files, setFiles] = useState<FileData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState(import.meta.env.VITE_API_LINK_KEY || "");
  const [folderId, setFolderId] = useState(
    import.meta.env.VITE_API_LINK_ID || ""
  );
  const [error, setError] = useState("");
  const [loadingProgress, setLoadingProgress] = useState("");
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  // Enhanced color palette for bars
  const chartColors = [
    "#8884d8", // Blue
    "#82ca9d", // Green
    "#ffc658", // Yellow
    "#ff7300", // Orange
    "#0088fe", // Light Blue
    "#00c49f", // Teal
    "#ffbb28", // Golden
    "#ff8042", // Red Orange
    "#8dd1e1", // Sky Blue
    "#d084d0", // Purple
    "#87d068", // Light Green
    "#ffa39e", // Pink
    "#b7eb8f", // Mint
    "#ffd666", // Light Yellow
    "#ff9c6e", // Peach
  ];

  // Toggle file expansion
  const toggleFileExpansion = (fileId: string) => {
    const newExpanded = new Set(expandedFiles);
    if (newExpanded.has(fileId)) {
      newExpanded.delete(fileId);
    } else {
      newExpanded.add(fileId);
    }
    setExpandedFiles(newExpanded);
  };

  // Enhanced field analysis with statistics
  const analyzeField = (values: any[], fieldName: string): FieldInfo => {
    const nonNullValues = values.filter(
      (v) => v !== null && v !== undefined && v !== "" && v !== "N/A"
    );
    const uniqueValues = new Set(nonNullValues).size;
    const sampleValues = Array.from(new Set(nonNullValues.slice(0, 5))).map(
      (v) => String(v)
    );

    let type: FieldInfo["type"] = "text";
    let isMetric = false;
    let isDimension = false;
    let total: number | undefined;
    let average: number | undefined;
    let min: number | undefined;
    let max: number | undefined;

    if (nonNullValues.length === 0) {
      return {
        name: fieldName,
        type: "text",
        isMetric: false,
        isDimension: false,
        uniqueValues: 0,
        sampleValues: [],
      };
    }

    // Check if all values are numeric (including decimal numbers)
    const numericValues = nonNullValues
      .filter((v) => {
        const numStr = v.toString().replace(/[$,%]/g, "");
        return !isNaN(Number(numStr)) && numStr.trim() !== "";
      })
      .map((v) => {
        const numStr = v.toString().replace(/[$,%]/g, "");
        return Number(numStr);
      });

    // Currency detection
    if (
      nonNullValues.some(
        (v) =>
          typeof v === "string" &&
          /^\$?\d+(\.\d{2})?$/.test(v.toString().replace(/,/g, ""))
      )
    ) {
      type = "currency";
      isMetric = true;
      if (numericValues.length > 0) {
        total = numericValues.reduce((sum, val) => sum + val, 0);
        average = total / numericValues.length;
        min = Math.min(...numericValues);
        max = Math.max(...numericValues);
      }
    }
    // Number detection - if most values are numeric
    else if (numericValues.length >= nonNullValues.length * 0.8) {
      type = "number";
      isMetric = true;
      if (numericValues.length > 0) {
        total = numericValues.reduce((sum, val) => sum + val, 0);
        average = total / numericValues.length;
        min = Math.min(...numericValues);
        max = Math.max(...numericValues);
      }
    }
    // Category detection - if we have reasonable number of unique text values
    else if (
      uniqueValues > 1 &&
      uniqueValues <= Math.max(20, nonNullValues.length * 0.7) &&
      numericValues.length < nonNullValues.length * 0.5
    ) {
      type = "category";
      isDimension = true;
    }

    // Special handling for common field names
    const lowerFieldName = fieldName.toLowerCase();
    if (
      lowerFieldName.includes("name") ||
      lowerFieldName.includes("mesin") ||
      lowerFieldName.includes("category") ||
      lowerFieldName.includes("type") ||
      lowerFieldName.includes("status") ||
      lowerFieldName.includes("department")
    ) {
      type = "category";
      isDimension = true;
      isMetric = false;
    }

    if (
      lowerFieldName.includes("total") ||
      lowerFieldName.includes("amount") ||
      lowerFieldName.includes("jam") ||
      lowerFieldName.includes("hour") ||
      lowerFieldName.includes("count") ||
      lowerFieldName.includes("sum") ||
      lowerFieldName.includes("qty") ||
      lowerFieldName.includes("quantity") ||
      lowerFieldName.includes("price") ||
      lowerFieldName.includes("cost")
    ) {
      if (numericValues.length > 0) {
        type =
          lowerFieldName.includes("price") || lowerFieldName.includes("cost")
            ? "currency"
            : "number";
        isMetric = true;
        isDimension = false;
      }
    }

    return {
      name: fieldName,
      type,
      isMetric,
      isDimension,
      uniqueValues,
      sampleValues,
      total,
      average,
      min,
      max,
    };
  };

  useEffect(() => {
    setApiKey(import.meta.env.VITE_API_LINK_KEY || "");
    setFolderId(import.meta.env.VITE_API_LINK_ID || "");
    // Automatically fetch files on mount if API key and folder ID are set
    if (apiKey && folderId) {
      fetchGoogleDriveFiles();
    }
  }, [apiKey, folderId]);

  // Generate single bar chart per file with data total
  const generateBarChart = (
    data: DataItem[],
    fields: FieldInfo[],
    fileName: string,
    fileId: string
  ): ChartConfig | null => {
    const metrics = fields.filter((f) => f.isMetric);
    const dimensions = fields.filter((f) => f.isDimension);

    console.log(`File: ${fileName}`);
    console.log("Fields analysis:", fields);
    console.log("Metrics:", metrics);
    console.log("Dimensions:", dimensions);

    if (metrics.length === 0 || dimensions.length === 0) {
      return null;
    }

    const metric = metrics[0]; // Take first metric
    const dimension = dimensions[0]; // Take first dimension

    // Aggregate data by dimension
    const aggregated: { [key: string]: number } = {};
    let dataTotal = 0;

    data.forEach((row) => {
      const cat = (row[dimension.name] as string) || "Unknown";
      const val =
        parseFloat(String(row[metric.name]).replace(/[$,%]/g, "")) || 0;
      aggregated[cat] = (aggregated[cat] || 0) + val;
      dataTotal += val;
    });

    const chartData = Object.entries(aggregated)
      .map(([name, value]) => ({
        [dimension.name]: name,
        [metric.name]: value,
      }))
      .sort((a: any, b: any) => b[metric.name] - a[metric.name])
      .slice(0, 10);

    return {
      id: `${fileId}-bar`,
      fileId,
      type: "bar",
      title: `${metric.name} by ${dimension.name}`,
      xAxis: dimension.name,
      yAxis: metric.name,
      data: chartData,
      dataTotal,
    };
  };

  // Process file data with enhanced statistics
  const processFileData = (
    rawData: DataItem[],
    fileName: string,
    fileId: string,
    fileSize?: string
  ): FileData => {
    if (!rawData || rawData.length === 0) {
      return {
        id: fileId,
        name: fileName,
        data: [],
        fields: [],
        chart: null,
        totalRows: 0,
        totalColumns: 0,
        fileSize,
      };
    }

    // Clean and normalize data
    const cleanedData = rawData.map((row) => {
      const cleanRow: any = {};
      Object.keys(row).forEach((key) => {
        const cleanKey = key.toString().trim();
        let value = row[key];

        if (typeof value === "string") {
          value = value.trim();
          // Try to parse numbers (including decimals)
          const numValue = parseFloat(value.replace(/[$,]/g, ""));
          if (!isNaN(numValue) && value.match(/^\$?[\d,.]+$/)) {
            value = numValue;
          }
        }

        cleanRow[cleanKey] = value;
      });
      return cleanRow;
    });

    // Analyze all fields
    const fieldNames = Object.keys(cleanedData[0] || {});
    const fields = fieldNames.map((name) => {
      const values = cleanedData.map((row) => row[name]);
      return analyzeField(values, name);
    });

    const chart = generateBarChart(cleanedData, fields, fileName, fileId);

    return {
      id: fileId,
      name: fileName,
      data: cleanedData,
      fields,
      chart,
      totalRows: cleanedData.length,
      totalColumns: fieldNames.length,
      fileSize,
    };
  };

  // Download and parse Excel file
  const downloadAndParseExcel = async (
    fileId: string,
    fileName: string,
    fileSize?: number
  ) => {
    try {
      setLoadingProgress(`Processing ${fileName}...`);

      // Download file content
      const downloadResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`
      );

      if (!downloadResponse.ok) {
        throw new Error(
          `Failed to download ${fileName}: ${downloadResponse.status}`
        );
      }

      // Get file as array buffer
      const arrayBuffer = await downloadResponse.arrayBuffer();

      // Parse with SheetJS
      const workbook = XLSX.read(arrayBuffer, { type: "array" });

      // Get first worksheet
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Convert to JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      // Convert to proper format (first row as headers)
      if (jsonData.length < 2) {
        throw new Error(`${fileName} has insufficient data`);
      }

      const headers = jsonData[0] as string[];
      const rows = jsonData.slice(1) as any[][];

      const formattedData = rows.map((row) => {
        const obj: any = {};
        headers.forEach((header, index) => {
          obj[header] = row[index] !== undefined ? row[index] : null;
        });
        return obj;
      });

      const fileSizeStr = fileSize
        ? `${(fileSize / 1024).toFixed(1)} KB`
        : undefined;

      return processFileData(formattedData, fileName, fileId, fileSizeStr);
    } catch (error: any) {
      console.error(`Error processing ${fileName}:`, error);
      return {
        id: fileId,
        name: fileName,
        data: [],
        fields: [],
        chart: null,
        totalRows: 0,
        totalColumns: 0,
        error: error.message,
      };
    }
  };

  // Fetch files from Google Drive and parse them
  const fetchGoogleDriveFiles = async () => {
    if (!apiKey || !folderId) {
      setError("Please provide both API Key and Folder ID");
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

      // Fetch Excel files
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

      if (result.error) {
        throw new Error(`API Error: ${result.error.message}`);
      }

      const excelFiles = result.files || [];

      if (excelFiles.length === 0) {
        setError("No Excel files found in the specified folder");
        setIsLoading(false);
        return;
      }

      setLoadingProgress(
        `Found ${excelFiles.length} Excel files. Processing...`
      );

      // Download and parse each Excel file
      const processedFiles: FileData[] = [];

      for (let i = 0; i < excelFiles.length; i++) {
        const file = excelFiles[i];
        setLoadingProgress(
          `Processing ${file.name} (${i + 1}/${excelFiles.length})...`
        );

        const fileData = await downloadAndParseExcel(
          file.id,
          file.name,
          file.size
        );
        processedFiles.push(fileData);
      }

      setFiles(processedFiles);
      setLoadingProgress("");

      const successfulFiles = processedFiles.filter((f) => f.data.length > 0);
      const failedFiles = processedFiles.filter((f) => f.data.length === 0);

      if (successfulFiles.length === 0) {
        setError(
          "No files could be processed successfully. Check file formats and permissions."
        );
      } else if (failedFiles.length > 0) {
        setError(
          `${successfulFiles.length} files processed successfully. ${failedFiles.length} files failed to process.`
        );
      }
    } catch (error: any) {
      setError(`Error: ${error.message}`);
      setLoadingProgress("");
    } finally {
      setIsLoading(false);
    }
  };

  // Get field type icon
  const getFieldTypeIcon = (field: FieldInfo) => {
    switch (field.type) {
      case "number":
        return <Hash className="w-4 h-4 text-blue-500" />;
      case "currency":
        return <DollarSign className="w-4 h-4 text-green-500" />;
      case "category":
        return <Tag className="w-4 h-4 text-purple-500" />;
      default:
        return <Type className="w-4 h-4 text-gray-500" />;
    }
  };

  // Format number for display
  const formatNumber = (num: number, type: string) => {
    if (type === "currency") {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(num);
    }
    return new Intl.NumberFormat().format(Math.round(num * 100) / 100);
  };

  // Custom label formatter for bars
  const renderCustomLabel = (props: any) => {
    const { x, y, width, height, value } = props;
    const formattedValue = new Intl.NumberFormat().format(
      Math.round(value * 100) / 100
    );
    console.log(height);
    return (
      <text
        x={x + width / 2}
        y={y - 5}
        fill="#333"
        textAnchor="middle"
        fontSize="12"
        fontWeight="500"
      >
        {formattedValue}
      </text>
    );
  };

  // Render bar chart with enhanced colors and labels
  const renderBarChart = (config: ChartConfig) => {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-800">
              {config.title}
            </h3>
          </div>
          <div className="text-sm text-gray-600">
            Total: {formatNumber(config.dataTotal, "number")}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart
            data={config.data}
            margin={{ top: 30, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey={config.xAxis}
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip
              formatter={(value: any) => [
                formatNumber(value, "number"),
                config.yAxis,
              ]}
              contentStyle={{
                backgroundColor: "#fff",
                border: "1px solid #ccc",
                borderRadius: "8px",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
              }}
            />
            <Legend />
            <Bar dataKey={config.yAxis} radius={[4, 4, 0, 0]}>
              <LabelList content={renderCustomLabel} />
              {config.data.map((entry, index) => {
                console.log(entry);
                return (
                  <Cell
                    key={`cell-${index}`}
                    fill={chartColors[index % chartColors.length]}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };
  const navigateToMap = () => {
    window.location.href = "/map";
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="flex h-screen">
        {/* Main Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <Folder className="w-8 h-8 text-blue-600" />
                <div>
                  <h1 className="text-3xl font-bold text-gray-800">
                    Excel Dashboard
                  </h1>
                </div>
              </div>

              <button
                onClick={navigateToMap}
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors duration-200 shadow-md"
              >
                <Map className="w-5 h-5" />
                <span>View Map</span>
              </button>
            </div>

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                {error}
              </div>
            )}
          </div>

          {/* Charts Section */}
          {files.some((f) => f.chart) && (
            <div className="space-y-6">
              {/* Charts Grid */}
              <div className="grid grid-cols-2 gap-6">
                {files
                  .filter((file) => file.chart)
                  .map((file) => (
                    <div key={file.id}>
                      {file.chart && renderBarChart(file.chart)}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="bg-white rounded-xl shadow-lg p-12 text-center">
              <RefreshCw className="w-16 h-16 text-blue-600 mx-auto mb-4 animate-spin" />
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                Processing Excel Files...
              </h3>
              <p className="text-gray-600">
                {loadingProgress || "Downloading and parsing Excel data"}
              </p>
            </div>
          )}

          {/* No Data State */}
          {!isLoading && files.length === 0 && (
            <div className="bg-white rounded-xl shadow-lg p-12 text-center">
              <Database className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                No Excel Files Found
              </h3>
              <p className="text-gray-600">
                Make sure your API key and folder ID are configured correctly
              </p>
            </div>
          )}
        </div>

        {/* Right Sidebar - File List */}
        <div className="w-96 bg-white shadow-xl p-6 overflow-y-auto border-l border-gray-200">
          <div className="flex items-center space-x-3 mb-6">
            <FileSpreadsheet className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-800">
              Excel Files ({files.length})
            </h2>
          </div>

          {files.length > 0 && (
            <div className="space-y-4">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="border border-gray-200 rounded-lg overflow-hidden"
                >
                  {/* File Header */}
                  <div
                    className="p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => toggleFileExpansion(file.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {expandedFiles.has(file.id) ? (
                          <ChevronDown className="w-4 h-4 text-gray-500" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-500" />
                        )}
                        <FileSpreadsheet className="w-4 h-4 text-blue-500" />
                        <span className="font-medium text-gray-800 text-sm truncate">
                          {file.name}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {file.chart ? "✅" : "❌"}
                      </div>
                    </div>

                    <div className="mt-2 text-xs text-gray-600">
                      <div className="flex justify-between">
                        <span>{file.totalRows} rows</span>
                        <span>{file.totalColumns} columns</span>
                      </div>
                      {file.fileSize && (
                        <div className="mt-1">{file.fileSize}</div>
                      )}
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {expandedFiles.has(file.id) && (
                    <div className="p-4 border-t border-gray-200">
                      <div className="space-y-4">
                        {/* Field Summary */}
                        <div>
                          <h4 className="font-medium text-gray-800 mb-2">
                            Fields Summary
                          </h4>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="bg-blue-50 p-2 rounded">
                              <span className="text-blue-700 font-medium">
                                {file.fields.filter((f) => f.isMetric).length}
                              </span>
                              <span className="text-blue-600 ml-1">
                                Metrics
                              </span>
                            </div>
                            <div className="bg-purple-50 p-2 rounded">
                              <span className="text-purple-700 font-medium">
                                {
                                  file.fields.filter((f) => f.isDimension)
                                    .length
                                }
                              </span>
                              <span className="text-purple-600 ml-1">
                                Categories
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Fields List */}
                        <div>
                          <h4 className="font-medium text-gray-800 mb-2">
                            Field Details
                          </h4>
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {file.fields.map((field, index) => (
                              <div
                                key={index}
                                className="border border-gray-100 rounded p-3"
                              >
                                <div className="flex items-center space-x-2 mb-2">
                                  {getFieldTypeIcon(field)}
                                  <span className="font-medium text-sm text-gray-800">
                                    {field.name}
                                  </span>
                                  <span
                                    className={`px-2 py-1 rounded text-xs ${
                                      field.isMetric
                                        ? "bg-blue-100 text-blue-700"
                                        : field.isDimension
                                        ? "bg-purple-100 text-purple-700"
                                        : "bg-gray-100 text-gray-700"
                                    }`}
                                  >
                                    {field.isMetric
                                      ? "Metric"
                                      : field.isDimension
                                      ? "Category"
                                      : "Text"}
                                  </span>
                                </div>

                                <div className="text-xs text-gray-600 space-y-1">
                                  <div>Type: {field.type}</div>
                                  <div>Unique values: {field.uniqueValues}</div>
                                  {field.sampleValues.length > 0 && (
                                    <div>
                                      Sample:{" "}
                                      {field.sampleValues
                                        .slice(0, 3)
                                        .join(", ")}
                                    </div>
                                  )}
                                  {field.isMetric &&
                                    field.total !== undefined && (
                                      <div className="space-y-1 mt-2 pt-2 border-t border-gray-200">
                                        <div>
                                          Total:{" "}
                                          {formatNumber(
                                            field.total,
                                            field.type
                                          )}
                                        </div>
                                        {field.average !== undefined && (
                                          <div>
                                            Average:{" "}
                                            {formatNumber(
                                              field.average,
                                              field.type
                                            )}
                                          </div>
                                        )}
                                        {field.min !== undefined &&
                                          field.max !== undefined && (
                                            <div>
                                              Range:{" "}
                                              {formatNumber(
                                                field.min,
                                                field.type
                                              )}{" "}
                                              -{" "}
                                              {formatNumber(
                                                field.max,
                                                field.type
                                              )}
                                            </div>
                                          )}
                                      </div>
                                    )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Chart Info */}
                        {file.chart && (
                          <div>
                            <h4 className="font-medium text-gray-800 mb-2">
                              Chart Generated
                            </h4>
                            <div className="bg-green-50 p-3 rounded text-sm">
                              <div className="text-green-800 font-medium">
                                {file.chart.title}
                              </div>
                              <div className="text-green-600 text-xs mt-1">
                                X-Axis: {file.chart.xAxis} | Y-Axis:{" "}
                                {file.chart.yAxis}
                              </div>
                              <div className="text-green-600 text-xs">
                                Data Total:{" "}
                                {formatNumber(file.chart.dataTotal, "number")}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {isLoading && (
            <div className="text-center py-8">
              <RefreshCw className="w-8 h-8 text-blue-600 mx-auto mb-2 animate-spin" />
              <p className="text-sm text-gray-600">Loading files...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SimpleExcelDashboard;
