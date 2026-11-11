const assert=require('node:assert/strict'),{Prisma}=require('@prisma/client'),{Logger}=require('@nestjs/common');
const {DatabaseErrorFilter}=require('../apps/api/dist/database-errors');
const marker='PRIVATE_TEST_MARKER',original=Logger.error,logs=[];
Logger.error=value=>logs.push(value);
try{
 for(const [error,status,code] of [
  [new Prisma.PrismaClientKnownRequestError(marker,{code:'P2022',clientVersion:'test',meta:{column:marker}}),503,'DATABASE_SCHEMA_NOT_READY'],
  [new Prisma.PrismaClientKnownRequestError(marker,{code:'P2021',clientVersion:'test'}),503,'DATABASE_SCHEMA_NOT_READY'],
  [new Prisma.PrismaClientInitializationError(marker,'test','P1001'),503,'DATABASE_UNAVAILABLE'],
  [new Prisma.PrismaClientInitializationError(marker,'test'),503,'DATABASE_UNAVAILABLE'],
  [new Prisma.PrismaClientKnownRequestError(marker,{code:'P2002',clientVersion:'test'}),500,'DATABASE_OPERATION_FAILED'],
 ]){
  let body,httpStatus;const response={status(value){httpStatus=value;return this;},json(value){body=value;}};
  new DatabaseErrorFilter().catch(error,{switchToHttp:()=>({getResponse:()=>response})});
  assert.equal(httpStatus,status);assert.equal(body.code,code);assert.ok(!JSON.stringify(body).includes(marker));assert.deepEqual(Object.keys(body).sort(),['code','message','statusCode']);
 }
 assert.ok(!JSON.stringify(logs).includes(marker));assert.ok(logs.every(line=>/^P\d{4}$|^UNCLASSIFIED$/.test(JSON.parse(line).prismaCode)));
 console.log('PASS: five Prisma schema/connection/operation failures emit only safe public codes and bounded logs');
}finally{Logger.error=original;}
