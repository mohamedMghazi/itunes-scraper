import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class SearchResult extends Document {
  @Prop({ required: true, unique: true })
  query: string;

  @Prop({ type: [String] })
  podcastIds: string[];

  @Prop({ type: [String] })
  episodeIds: string[];

  @Prop()
  expiresAt: Date;
}

export const SearchResultSchema = SchemaFactory.createForClass(SearchResult);

// Indexes for performance and automatic cleanup
SearchResultSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
SearchResultSchema.index({ query: 1 }, { unique: true });
SearchResultSchema.index({ query: 1, expiresAt: 1 });
SearchResultSchema.index({ createdAt: -1 });
SearchResultSchema.index({ updatedAt: -1 });
