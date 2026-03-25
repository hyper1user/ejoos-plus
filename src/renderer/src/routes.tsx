import { Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import PersonnelRegistry from './pages/PersonnelRegistry'
import PersonnelCard from './pages/PersonnelCard'
import ExcludedPersonnel from './pages/ExcludedPersonnel'
import OrgStructure from './pages/OrgStructure'
import StaffingTable from './pages/StaffingTable'
import PositionRegistry from './pages/PositionRegistry'
import StaffRoster from './pages/StaffRoster'
import Movements from './pages/Movements'
import StatusBoard from './pages/StatusBoard'
import MonthlyAttendance from './pages/MonthlyAttendance'
import FormationReport from './pages/FormationReport'
import Orders from './pages/Orders'
import MissingDocuments from './pages/MissingDocuments'
import LeaveRecords from './pages/LeaveRecords'
import InjuriesLosses from './pages/InjuriesLosses'
import DocumentGenerator from './pages/DocumentGenerator'
import DocumentArchive from './pages/DocumentArchive'
import Statistics from './pages/Statistics'
import DgvPage from './pages/DgvPage'
import ImportExport from './pages/ImportExport'
import Settings from './pages/Settings'

export default function AppRoutes(): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/personnel" element={<PersonnelRegistry />} />
      <Route path="/personnel/excluded" element={<ExcludedPersonnel />} />
      <Route path="/personnel/:id" element={<PersonnelCard />} />
      <Route path="/org-structure" element={<OrgStructure />} />
      <Route path="/staffing" element={<StaffingTable />} />
      <Route path="/positions" element={<PositionRegistry />} />
      <Route path="/staff-roster" element={<StaffRoster />} />
      <Route path="/movements" element={<Movements />} />
      <Route path="/statuses" element={<StatusBoard />} />
      <Route path="/attendance" element={<MonthlyAttendance />} />
      <Route path="/formation-report" element={<FormationReport />} />
      <Route path="/orders" element={<Orders />} />
      <Route path="/missing-docs" element={<MissingDocuments />} />
      <Route path="/leave" element={<LeaveRecords />} />
      <Route path="/injuries" element={<InjuriesLosses />} />
      <Route path="/documents/generate" element={<DocumentGenerator />} />
      <Route path="/documents/archive" element={<DocumentArchive />} />
      <Route path="/dgv" element={<DgvPage />} />
      <Route path="/statistics" element={<Statistics />} />
      <Route path="/import-export" element={<ImportExport />} />
      <Route path="/settings" element={<Settings />} />
    </Routes>
  )
}
