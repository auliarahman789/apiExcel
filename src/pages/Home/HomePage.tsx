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
} from "recharts";
import { RefreshCw, Folder, BarChart3 } from "lucide-react";
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
  };

  type FileData = {
    id: string;
    name: string;
    data: DataItem[];
    fields: FieldInfo[];
    chart: ChartConfig | null;
  };

  interface ChartConfig {
    type: "bar";
    title: string;
    xAxis: string;
    yAxis: string;
    data: any[];
    id: string;
    fileId: string;
  }

  const [files, setFiles] = useState<FileData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState(import.meta.env.VITE_API_LINK_KEY || "");
  const [folderId, setFolderId] = useState(
    import.meta.env.VITE_API_LINK_ID || ""
  );
  const [error, setError] = useState("");
  const [loadingProgress, setLoadingProgress] = useState("");

  // Improved field analysis
  const analyzeField = (values: any[], fieldName: string): FieldInfo => {
    const nonNullValues = values.filter(
      (v) => v !== null && v !== undefined && v !== "" && v !== "N/A"
    );
    const uniqueValues = new Set(nonNullValues).size;

    let type: FieldInfo["type"] = "text";
    let isMetric = false;
    let isDimension = false;

    if (nonNullValues.length === 0) {
      return {
        name: fieldName,
        type: "text",
        isMetric: false,
        isDimension: false,
      };
    }

    // Check if all values are numeric (including decimal numbers)
    const numericValues = nonNullValues.filter((v) => {
      const numStr = v.toString().replace(/[$,%]/g, "");
      return !isNaN(Number(numStr)) && numStr.trim() !== "";
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
    }
    // Number detection - if most values are numeric
    else if (numericValues.length >= nonNullValues.length * 0.8) {
      type = "number";
      isMetric = true;
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
      lowerFieldName.includes("type")
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
      lowerFieldName.includes("sum")
    ) {
      if (numericValues.length > 0) {
        type = "number";
        isMetric = true;
        isDimension = false;
      }
    }

    return {
      name: fieldName,
      type,
      isMetric,
      isDimension,
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
  // Generate single bar chart per file
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
    data.forEach((row) => {
      const cat = (row[dimension.name] as string) || "Unknown";
      const val =
        parseFloat(String(row[metric.name]).replace(/[$,%]/g, "")) || 0;
      aggregated[cat] = (aggregated[cat] || 0) + val;
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
    };
  };

  // Process file data
  const processFileData = (
    rawData: DataItem[],
    fileName: string,
    fileId: string
  ): FileData => {
    if (!rawData || rawData.length === 0) {
      return {
        id: fileId,
        name: fileName,
        data: [],
        fields: [],
        chart: null,
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
    };
  };

  // Download and parse Excel file
  const downloadAndParseExcel = async (fileId: string, fileName: string) => {
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

      return processFileData(formattedData, fileName, fileId);
    } catch (error: any) {
      console.error(`Error processing ${fileName}:`, error);
      return {
        id: fileId,
        name: fileName,
        data: [],
        fields: [],
        chart: null,
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

        const fileData = await downloadAndParseExcel(file.id, file.name);
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

  // Render bar chart
  const renderBarChart = (config: ChartConfig) => {
    const colors = ["#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#0088fe"];

    return (
      <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
        <div className="flex items-center space-x-3 mb-4">
          <BarChart3 className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-800">
            {config.title}
          </h3>
        </div>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={config.data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={config.xAxis} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey={config.yAxis} fill={colors[0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <Folder className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-3xl font-bold text-gray-800">
                  Excel Dashboard
                </h1>
                <p className="text-gray-600">
                  Direct Excel reading with automatic chart generation
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {/* File Summary */}
          {files.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-4">
                Loaded Files ({files.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {files.map((file) => (
                  <div key={file.id} className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-800 mb-2">
                      {file.name}
                    </h4>
                    <p className="text-sm text-gray-600">
                      {file.data.length} rows, {file.fields.length} columns
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Chart:{" "}
                      {file.chart ? "✅ Generated" : "❌ No suitable data"}
                    </p>
                    {file.fields.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-500">
                          Metrics:{" "}
                          {file.fields
                            .filter((f) => f.isMetric)
                            .map((f) => f.name)
                            .join(", ") || "None"}
                        </p>
                        <p className="text-xs text-gray-500">
                          Categories:{" "}
                          {file.fields
                            .filter((f) => f.isDimension)
                            .map((f) => f.name)
                            .join(", ") || "None"}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Charts Section */}
        {files.some((f) => f.chart) && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">
                Generated Charts ({files.filter((f) => f.chart).length})
              </h2>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
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
      </div>
    </div>
  );
};

export default SimpleExcelDashboard;
