import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ToolUpstream } from './entities/tool-upstream.entity';
import { ToolBridge } from './entities/tool-bridge.entity';
import { ToolUpstreamsService } from './tool-upstreams.service';
import { ToolBridgesService } from './tool-bridges.service';
import { ToolUpstreamsController } from './tool-upstreams.controller';
import { ToolBridgesController } from './tool-bridges.controller';
import { ParamSchemaValidator } from './param-schema.validator';

// CryptoModule is @Global() — TokenCipherService injected without re-import.
@Module({
  imports: [TypeOrmModule.forFeature([ToolUpstream, ToolBridge])],
  providers: [ToolUpstreamsService, ToolBridgesService, ParamSchemaValidator],
  controllers: [ToolUpstreamsController, ToolBridgesController],
  exports: [ToolUpstreamsService, ToolBridgesService],
})
export class ToolBridgesModule {}
