import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

import { AppConfig } from '../config/app.config';
import { DatabaseConfig } from '../config/database.config';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [DatabaseConfig, AppConfig],
      useFactory: (database: DatabaseConfig, app: AppConfig) => ({
        uri: database.uri,
        dbName: database.databaseName,
        poolSize: database.poolSize,
        autoIndex: !app.isProduction,
        autoCreate: !app.isProduction,
        bufferCommands: false,
        serverSelectionTimeoutMS: 5000,
        maxTimeMS: database.queryTimeoutMs,
        connectionFactory: (connection: Connection) => {
          connection.on('error', (error: Error) => {
            console.error('MongoDB connection error', error.message);
          });
          return connection;
        },
      }),
    }),
  ],
})
export class DatabaseModule {}
