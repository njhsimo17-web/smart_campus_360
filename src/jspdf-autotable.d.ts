declare module 'jspdf-autotable' {
  import type { jsPDF } from 'jspdf';
  const autoTable: (document: jsPDF, options: any) => void;
  export default autoTable;
}
