export interface Personnel {
  id: number
  ipn: string
  rankId: number | null
  lastName: string
  firstName: string
  patronymic: string | null
  fullName: string
  callsign: string | null
  dateOfBirth: string | null
  phone: string | null

  enrollmentOrderDate: string | null
  enrollmentOrderInfo: string | null
  arrivedFrom: string | null
  arrivalPositionIdx: string | null
  enrollmentDate: string | null
  enrollmentOrderNum: string | null

  currentPositionIdx: string | null
  currentStatusCode: string | null
  currentSubdivision: string | null

  rankOrderDate: string | null
  rankOrderInfo: string | null

  serviceType: string | null
  contractDate: string | null
  contractTypeId: number | null
  contractEndDate: string | null

  idDocSeries: string | null
  idDocNumber: string | null
  idDocType: string | null
  passportSeries: string | null
  passportNumber: string | null
  passportIssuedBy: string | null
  passportIssuedDate: string | null
  militaryIdSeries: string | null
  militaryIdNumber: string | null
  ubdSeries: string | null
  ubdNumber: string | null
  ubdDate: string | null

  gender: string | null
  bloodTypeId: number | null
  fitness: string | null
  educationLevelId: number | null
  educationInstitution: string | null
  educationYear: string | null
  militaryEducation: string | null
  birthplace: string | null
  addressActual: string | null
  addressRegistered: string | null
  maritalStatus: string | null
  relativesInfo: string | null
  nationality: string | null
  citizenship: string | null

  conscriptionDate: string | null
  tccId: number | null
  oblast: string | null

  personalNumber: string | null
  specialtyCode: string | null
  photoPath: string | null

  status: 'active' | 'excluded' | 'disposed'
  excludedAt: string | null
  additionalInfo: string | null
  notes: string | null

  // Закордонний паспорт
  foreignPassportSeries: string | null
  foreignPassportNumber: string | null
  foreignPassportIssuedBy: string | null
  foreignPassportIssuedDate: string | null

  // ВК додатково
  militaryIdIssuedBy: string | null
  militaryIdIssuedDate: string | null

  // УБД додатково
  ubdIssuedBy: string | null

  // Фінансові дані
  iban: string | null
  bankCard: string | null
  bankName: string | null

  // Посвідчення водія
  driverLicenseIssuedBy: string | null
  driverLicenseCategory: string | null
  driverLicenseExpiry: string | null
  driverLicenseIssuedDate: string | null
  driverLicenseExperience: number | null
  driverLicenseSeries: string | null
  driverLicenseNumber: string | null

  // Посвідчення тракториста
  tractorLicenseIssuedBy: string | null
  tractorLicenseCategory: string | null
  tractorLicenseExpiry: string | null
  tractorLicenseIssuedDate: string | null
  tractorLicenseExperience: number | null
  tractorLicenseSeries: string | null
  tractorLicenseNumber: string | null

  // Базова загальновійськова підготовка
  basicTrainingDateFrom: string | null
  basicTrainingDateTo: string | null
  basicTrainingPlace: string | null
  basicTrainingCommander: string | null
  basicTrainingNotes: string | null

  createdAt: string
  updatedAt: string
}

export interface PersonnelListItem {
  id: number
  ipn: string
  fullName: string
  rankName: string | null
  rankCategory: string | null
  callsign: string | null
  currentPositionIdx: string | null
  positionTitle: string | null
  currentStatusCode: string | null
  statusName: string | null
  currentSubdivision: string | null
  phone: string | null
  status: string
}
