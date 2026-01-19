import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Podcast extends Document {
  @Prop({ required: true })
  collectionId: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  author: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ required: true })
  imageUrl: string;

  @Prop({ default: 'Unknown' })
  subscriberCount: string;

  @Prop({ type: Object })
  rawData: Record<string, any>;
}

export const PodcastSchema = SchemaFactory.createForClass(Podcast);

// Indexes for higher performance
PodcastSchema.index({ collectionId: 1 }, { unique: true });
PodcastSchema.index({ title: 'text', author: 'text' });
PodcastSchema.index({ updatedAt: -1 });
PodcastSchema.index({ createdAt: -1 });
