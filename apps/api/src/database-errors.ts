import {ArgumentsHost, Catch, ExceptionFilter, Logger} from '@nestjs/common';
import {Prisma} from '@prisma/client';

// Never let the default exception logger print Prisma's SQL/parameters/connection text.
@Catch(Prisma.PrismaClientKnownRequestError, Prisma.PrismaClientInitializationError)
export class DatabaseErrorFilter implements ExceptionFilter {
  catch(error: Prisma.PrismaClientKnownRequestError | Prisma.PrismaClientInitializationError, host: ArgumentsHost) {
    const rawCode='code' in error?error.code:error.errorCode;
    const prismaCode=typeof rawCode==='string'&&/^P\d{4}$/.test(rawCode)?rawCode:'UNCLASSIFIED';
    const schema=['P2021','P2022'].includes(prismaCode);
    const unavailable=schema||['P1000','P1001','P1002','P1011','P1017','P2024'].includes(prismaCode)||error instanceof Prisma.PrismaClientInitializationError;
    const code=schema?'DATABASE_SCHEMA_NOT_READY':unavailable?'DATABASE_UNAVAILABLE':'DATABASE_OPERATION_FAILED';
    Logger.error(JSON.stringify({event:'DATABASE_REQUEST_FAILED',code,prismaCode}),'DatabaseErrorFilter');
    const status=unavailable?503:500;
    host.switchToHttp().getResponse().status(status).json({statusCode:status,code,message:schema?'Veritabanı şeması bu API sürümü için hazır değil.':unavailable?'Veritabanına şu anda erişilemiyor.':'Veritabanı işlemi tamamlanamadı.'});
  }
}
