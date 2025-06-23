import React, { ReactNode } from "react";

const DefaultLayout: React.FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <div className="dark:bg-boxdark-2 dark:text-bodydark">
      <main>
        <div className="">{children}</div>
      </main>
    </div>
  );
};

export default DefaultLayout;
