import { Routes, Route } from 'react-router-dom';
import StrategyCreation from '../pages/StrategyCreation';
import MainLayout from '../layouts/MainLayout';

const AppRoutes = () => {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<StrategyCreation />} />
      </Route>
    </Routes>
  );
};

export default AppRoutes;
