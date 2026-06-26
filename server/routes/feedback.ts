import { Router, type Request, type Response } from 'express';
import {
  saveFeedback,
  type FeedbackRating,
} from '../feedback/store.js';

const router = Router();

const MAX_QUESTION_LENGTH = 10_000;
const MAX_ANSWER_LENGTH = 200_000;
const MAX_COMMENT_LENGTH = 5_000;
const RESPONSE_ID_PATTERN = /^[a-zA-Z0-9_-]{8,100}$/;

router.post('/api/feedback', async (req: Request, res: Response) => {
  const responseId: unknown = req.body?.responseId;
  const question: unknown = req.body?.question;
  const answerHtml: unknown = req.body?.answerHtml;
  const invoiceUid: unknown = req.body?.invoiceUid;
  const rating: unknown = req.body?.rating;
  const comment: unknown = req.body?.comment;

  if (
    typeof responseId !== 'string' ||
    !RESPONSE_ID_PATTERN.test(responseId)
  ) {
    res.status(400).json({ error: 'Invalid response ID.' });
    return;
  }

  if (
    typeof question !== 'string' ||
    question.length === 0 ||
    question.length > MAX_QUESTION_LENGTH
  ) {
    res.status(400).json({ error: 'Invalid question.' });
    return;
  }

  if (
    typeof answerHtml !== 'string' ||
    answerHtml.length === 0 ||
    answerHtml.length > MAX_ANSWER_LENGTH
  ) {
    res.status(400).json({ error: 'Invalid answer.' });
    return;
  }

  const normalizedRating: FeedbackRating =
    rating === 'good' || rating === 'bad' ? rating : null;
  const normalizedComment = typeof comment === 'string' ? comment.trim() : '';

  if (
    rating !== null &&
    rating !== undefined &&
    normalizedRating === null
  ) {
    res.status(400).json({ error: 'Rating must be "good", "bad", or null.' });
    return;
  }

  if (normalizedComment.length > MAX_COMMENT_LENGTH) {
    res.status(400).json({ error: 'Comment is too long.' });
    return;
  }

  if (normalizedRating === null && normalizedComment.length === 0) {
    res.status(400).json({ error: 'Add a rating or comment.' });
    return;
  }

  try {
    const saved = await saveFeedback({
      responseId,
      question,
      answerHtml,
      invoiceUid:
        typeof invoiceUid === 'string' && invoiceUid.trim()
          ? invoiceUid.trim()
          : null,
      rating: normalizedRating,
      comment: normalizedComment,
    });

    res.json({
      ok: true,
      responseId: saved.responseId,
      updatedAt: saved.updatedAt,
    });
  } catch (err) {
    console.error(
      '[feedback] Could not save feedback:',
      err instanceof Error ? err.message : err,
    );
    res.status(500).json({ error: 'Could not save feedback.' });
  }
});

export default router;
