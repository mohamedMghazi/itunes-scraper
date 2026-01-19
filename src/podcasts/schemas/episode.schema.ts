import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Episode extends Document {
  @Prop({ required: true })
  trackId: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  podcastTitle: string;

  @Prop()
  publishedDate: string;

  @Prop()
  duration: string;

  @Prop()
  imageUrl: string;

  @Prop({ type: Object })
  rawData: Record<string, any>;
}

export const EpisodeSchema = SchemaFactory.createForClass(Episode);

// Indexes for performance
EpisodeSchema.index({ trackId: 1 }, { unique: true });
EpisodeSchema.index({ title: 'text', podcastTitle: 'text' });
EpisodeSchema.index({ publishedDate: -1 });
EpisodeSchema.index({ createdAt: -1 });
EpisodeSchema.index({ updatedAt: -1 });
