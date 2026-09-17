import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ToolUpstream } from './entities/tool-upstream.entity';
import { ToolBridge } from './entities/tool-bridge.entity';
import { ToolUpstreamsService } from './tool-upstreams.service';
import { ToolBridgesService } from './tool-bridges.service';
import { ToolUpstreamsController } from './tool-upstreams.controller';
import { ToolBridgesController } from './tool-bridges.controller';
import { ParamSchemaValidator } from './param-schema.validator';
import { HttpProxyClient } from './http-proxy.client';
import { BridgeDispatcherService } from './bridge-dispatcher.service';

// CryptoModule, AuditModule, MetricsModule are @Global() — no explicit import needed.
@Module({
  imports: [TypeOrmModule.forFeature([ToolUpstream, ToolBridge])],
  providers: [
    ToolUpstreamsService,
    ToolBridgesService,
    ParamSchemaValidator,
    HttpProxyClient,
    BridgeDispatcherService,
  ],
  controllers: [ToolUpstreamsController, ToolBridgesController],
  exports: [ToolUpstreamsService, ToolBridgesService, BridgeDispatcherService],
})
export class ToolBridgesModule {}
