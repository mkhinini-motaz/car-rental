// A photo of a car's or a client's papers (App\Models\Document).
export default interface DocumentPhoto {
  id: number,
  type: number,
  url: string, // a car's is permanent (cached for police checks); a client's lasts an hour
  created_at: number,
}

export const CARTE_GRISE = 1;
export const INSURANCE = 2;
export const TECHNICAL_CONTROL = 3; // visite technique
export const CIRCULATION_TAX = 4; // vignette
export const CAR_DOCUMENTS = [ CARTE_GRISE, INSURANCE, TECHNICAL_CONTROL, CIRCULATION_TAX, 9 ];
export const CLIENT_DOCUMENTS = [ 11, 12, 13, 19 ]; // ID card, driving licence, passport, other
