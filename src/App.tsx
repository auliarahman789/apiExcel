import { BrowserRouter as Router, Routes, Route } from "react-router";
import PageTitle from "./components/PageTitle";
import LessonManagementSystem from "./pages/Home/HomePage";
import ExcelMapDashboard from "./pages/Home/MapPage";

export default function App() {
  return (
    <>
      <Router>
        <Routes>
          <Route
            path="/aa"
            element={
              <>
                <PageTitle title="Lesson Proyek Arul" />

                <LessonManagementSystem />
              </>
            }
          />
          <Route
            path="/"
            element={
              <>
                <PageTitle title="Lesson Proyek Arul" />

                <ExcelMapDashboard />
              </>
            }
          />
        </Routes>
      </Router>
    </>
  );
}
