import { Routes, Route } from 'react-router-dom';
import StrategyCreation from '../pages/StrategyCreation';
import MainLayout from '../layouts/MainLayout';
import HomePage from '../pages/HomePage';
import Login from '../pages/Login';

const AppRoutes = () => {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/strategy" element={<StrategyCreation />} />
      </Route>
    </Routes>
  );
};

export default AppRoutes;
