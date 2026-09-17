import i18n from '../i18n';
import { isDemoMode, isAdminMode } from '../utils/demoData';
import { apiFetch } from './httpClient';

export interface FeedbackSubmission {
  type: string;
  message: string;
}

export interface Feedback {
  _id: string;
  userId: string | null;
  imei: string | null;
  username: string | null;
  boatName: string | null;
  community: string | null;
  type: string;
  message: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  adminNotes: string | null;
  isAdminSubmission?: boolean;
}

/**
 * Submit feedback
 * @param feedback - The feedback data
 * @param imei - IMEI for PDS users (can be null for non-PDS users)
 * @param username - Username for non-PDS users (can be null for PDS users)
 */
export async function submitFeedback(
  feedback: FeedbackSubmission,
  imei: string | null,
  username: string | null = null
): Promise<Feedback> {
  // Check if we're in demo mode
  if (isDemoMode()) {
    console.log('Demo mode: simulating feedback submission');
    // Return a mock successful response
    return {
      _id: `demo-feedback-${Date.now()}`,
      userId: null,
      imei: imei || null,
      username: username || null,
      boatName: null,
      community: null,
      type: feedback.type,
      message: feedback.message,
      status: 'new',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      reviewedAt: null,
      reviewedBy: null,
      adminNotes: null
    };
  }

  try {
    const payload = {
      ...feedback,
      imei,
      username,
      // Include admin flag to protect real data
      isAdmin: isAdminMode()
    };

    const response = await apiFetch('/feedback', {
      method: 'POST',
      body: payload,
    });

    if (!response.ok) {
      let errorMessage = i18n.t('feedback.errors.submitFailed');

      // Handle specific HTTP status codes
      if (response.status === 400) {
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = i18n.t('feedback.errors.validationError');
        }
      } else if (response.status === 500) {
        errorMessage = i18n.t('api.serverError');
      }

      throw new Error(errorMessage);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error submitting feedback:', error);
    throw error;
  }
}

/**
 * Get feedback submitted by a user
 * @param userId - The user ID
 */
export async function getUserFeedback(userId: string): Promise<Feedback[]> {
  try {
    const response = await apiFetch(`/feedback/user/${userId}`);

    if (!response.ok) {
      throw new Error(i18n.t('api.failedToFetchData', { status: response.status }));
    }

    const feedback = await response.json();
    return feedback;
  } catch (error) {
    console.error('Error fetching user feedback:', error);
    throw error;
  }
}







