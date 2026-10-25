export type Outcome = 'ELIGIBLE' | 'INELIGIBLE' | 'UNKNOWN';
export type Criterion = {field: string; outcome: Outcome; reason: string};
export type Profile = {educationLevel?: string | null; exactDegreeProgramCode?: string | null; kpssScore?: number | null; kpssScoreType?: string | null; examYear?: number | null; ydsScore?: number | null; certificates?: string[]};
export type Requirements = {complete?: boolean; educationLevels?: string[]; degreeCodes?: string[]; degreeCodesVerified?: boolean; kpssRequired?: boolean; kpssScoreType?: string; kpssMinimumScore?: number; examYears?: number[]; ydsMinimumScore?: number; certificates?: string[]; otherConditions?: string[]};
export function evaluate(profile: Profile, requirements: Requirements, verified: boolean) {
  const reasons: Criterion[] = [];
  const add = (field: string, outcome: Outcome, reason: string) => reasons.push({field, outcome, reason});
  if (!verified) add('source', 'UNKNOWN', 'Kadro koşulları kaynaktan doğrulanmamış.');
  if (requirements.complete !== true) add('coverage', 'UNKNOWN', 'Tüm başvuru koşullarının kayda alındığı doğrulanmamış.');
  const oneOf = (field: keyof Profile, allowed: (string | number)[] | undefined) => {
    if (!allowed?.length) return;
    const actual = profile[field];
    add(field, actual == null ? 'UNKNOWN' : allowed.includes(actual as string | number) ? 'ELIGIBLE' : 'INELIGIBLE', actual == null ? 'Profilde bilgi eksik.' : allowed.includes(actual as string | number) ? 'Doğrulanmış koşul karşılanıyor.' : 'Doğrulanmış koşul karşılanmıyor.');
  };
  oneOf('educationLevel', requirements.educationLevels);
  if (requirements.degreeCodes?.length) {
    if (requirements.degreeCodesVerified !== true) add('exactDegreeProgramCode', 'UNKNOWN', 'Bölüm kodları/eşdeğerlik doğrulanmamış.');
    else oneOf('exactDegreeProgramCode', requirements.degreeCodes);
  }
  const minimum = (field: 'kpssScore' | 'ydsScore', required?: number) => {
    if (required === undefined) return;
    const actual = profile[field];
    add(field, actual == null ? 'UNKNOWN' : actual >= required ? 'ELIGIBLE' : 'INELIGIBLE', actual == null ? 'Profilde puan eksik.' : `Gerekli en az ${required}; profil puanı ${actual}.`);
  };
  if (requirements.kpssRequired !== false) {
    if (requirements.kpssRequired !== true || !requirements.kpssScoreType || requirements.kpssMinimumScore == null || !requirements.examYears?.length) add('kpss', 'UNKNOWN', 'KPSS koşulu, puan türü, sınav yılı veya taban puan eksik.');
    oneOf('kpssScoreType', requirements.kpssScoreType ? [requirements.kpssScoreType] : undefined);
    oneOf('examYear', requirements.examYears);
    minimum('kpssScore', requirements.kpssMinimumScore);
  }
  minimum('ydsScore', requirements.ydsMinimumScore);
  for (const certificate of requirements.certificates ?? []) add('certificate', profile.certificates?.includes(certificate) ? 'ELIGIBLE' : 'UNKNOWN', profile.certificates?.includes(certificate) ? `${certificate}: kullanıcı beyanı mevcut; belge aslı kurumca kontrol edilir.` : `${certificate}: belge bilgisi eksik; yokluğu kesinleştirilemez.`);
  for (const condition of requirements.otherConditions ?? []) add('other', 'UNKNOWN', `${condition}: insan doğrulaması gerekli.`);
  // Unverified data must never produce a definitive positive or negative decision.
  const outcome: Outcome = !verified ? 'UNKNOWN' : reasons.some(r => r.outcome === 'INELIGIBLE') ? 'INELIGIBLE' : reasons.some(r => r.outcome === 'UNKNOWN') ? 'UNKNOWN' : 'ELIGIBLE';
  return {outcome, reasons, disclaimer: 'Sonuç bilgilendirme amaçlıdır. Resmî metni ve kurumun kararını esas alın.'};
}
