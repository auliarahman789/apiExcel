import { BrowserRouter as Router, Routes, Route } from "react-router";
import PageTitle from "./components/PageTitle";
import LessonManagementSystem from "./pages/Home/HomePage";

export default function App() {
  return (
    <>
      <Router>
        <Routes>
          <Route
            path="/"
            element={
              <>
                <PageTitle title="Lesson Proyek Arul" />

                <LessonManagementSystem />
              </>
            }
          />
        </Routes>
      </Router>
    </>
  );
}
