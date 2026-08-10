import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

// Skip-re-consent record. If (userId, clientId, scope-set) match → auto-grant next authorize.
@Entity({ name: 'oauth_consents' })
@Unique(['userId', 'clientId'])
export class OAuthConsent {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ name: 'user_id', type: 'int' })
  userId!: number;

  @Index()
  @Column({ name: 'client_id', type: 'varchar', length: 32 })
  clientId!: string;

  // Sorted array of scopes user has approved.
  @Column({ type: 'jsonb' })
  scopes!: string[];

  @CreateDateColumn({ name: 'granted_at', type: 'timestamptz' })
  grantedAt!: Date;
}
