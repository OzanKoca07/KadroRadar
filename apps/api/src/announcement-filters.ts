import {BadRequestException} from '@nestjs/common';
import {Prisma} from '@prisma/client';

// These are search constraints, never a substitute for the eligibility evaluator.
// Every position constraint must hold for the SAME source-checked position.
export function positionFilters(query:Record<string,string|undefined>):Prisma.AnnouncementWhereInput[]{
 const conditions:Prisma.AnnouncementPositionWhereInput[]=[];
 const education=query.educationLevel?.trim(),type=query.kpssScoreType?.trim(),degree=query.degreeCode?.trim(),title=query.positionTitle?.trim();
 if(query.kpssRequired!==undefined&&query.kpssRequired!==''){
  if(!['true','false'].includes(query.kpssRequired))throw new BadRequestException('kpssRequired');
  if(query.kpssRequired==='false'&&(type||query.kpssScore))throw new BadRequestException('KPSS-free filter cannot require a KPSS score');
  conditions.push({requirements:{path:['kpssRequired'],equals:query.kpssRequired==='true'}});
 }
 if(query.employmentType){if(!['CIVIL_SERVANT','CONTRACTED','WORKER','ACADEMIC'].includes(query.employmentType))throw new BadRequestException('employmentType');conditions.push({requirements:{path:['employmentType'],equals:query.employmentType}});}
 if(education){if(!['LISANS','ONLISANS','ORTAOGRETIM'].includes(education))throw new BadRequestException('educationLevel');conditions.push({requirements:{path:['educationLevels'],array_contains:[education]}});}
 if(type){if(!['P3','P93','P94'].includes(type))throw new BadRequestException('kpssScoreType');conditions.push({requirements:{path:['kpssScoreType'],equals:type}});}
 if(query.kpssScore!==undefined&&query.kpssScore!==''){
  const score=Number(query.kpssScore?.replace(',','.'));if(!/^\d{1,3}([.,]\d{1,5})?$/.test(query.kpssScore!)||!Number.isFinite(score)||score<0||score>100)throw new BadRequestException('kpssScore');
  conditions.push({requirements:{path:['kpssMinimumScore'],lte:score}},{requirements:{path:['kpssRequired'],equals:true}});
 }
 if(degree){if(!/^[A-Za-z0-9_-]{1,64}$/.test(degree))throw new BadRequestException('Exact verified degreeCode required');conditions.push({requirements:{path:['degreeCodesVerified'],equals:true}},{requirements:{path:['degreeCodes'],array_contains:[degree]}});}
 if(title){if(title.length>100)throw new BadRequestException('positionTitle');conditions.push({title:{contains:title,mode:'insensitive'}});}
 if(query.city?.trim()&&conditions.length){const city={contains:query.city.trim().slice(0,100),mode:'insensitive' as const};conditions.push({OR:[{city},{announcement:{city}}]});}
 const result:Prisma.AnnouncementWhereInput[]=conditions.length?[{positions:{some:{verifiedAt:{not:null},AND:conditions}}}]:[];
 if(query.deadlineBefore){const date=query.deadlineBefore;if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw new BadRequestException('deadlineBefore YYYY-MM-DD');result.push({applicationEndAt:{lte:new Date(date+'T23:59:59.999+03:00')}});}
 return result;
}
