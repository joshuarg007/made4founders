// Social Post Mockup Components
import { Heart, MessageCircle, Repeat2, Share, MoreHorizontal, ThumbsUp, Send, Bookmark, Globe } from 'lucide-react';

interface SocialPostMockupProps {
  content: string;
  imageUrl?: string | null;
  userName: string;
  timestamp?: string;
}

// Helper to get initials from name or email
function getInitials(name: string): string {
  if (!name) return '?';
  if (name.includes('@')) {
    return name.charAt(0).toUpperCase();
  }
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  }
  return name.charAt(0).toUpperCase();
}

// Helper to generate a handle from name
function generateHandle(name: string): string {
  if (!name) return '@user';
  if (name.includes('@')) {
    return '@' + name.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  }
  return '@' + name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
}

// ============ Twitter/X Mockup ============
export function TwitterPostMockup({ content, imageUrl, userName, timestamp = 'Just now' }: SocialPostMockupProps) {
  const initials = getInitials(userName);
  const handle = generateHandle(userName);
  const displayName = userName.includes('@') ? userName.split('@')[0] : userName;

  return (
    <div className="relative bg-black rounded-2xl border border-gray-800 overflow-hidden font-sans shadow-xl">
      {/* Preview Badge */}
      <div className="absolute top-2 right-2 z-10">
        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 uppercase tracking-wider">Preview</span>
      </div>
      {/* Post Content */}
      <div className="p-4">
        <div className="flex gap-3">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-lg">
            {initials}
          </div>

          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-1 text-sm">
              <span className="font-bold text-white truncate">{displayName}</span>
              <span className="text-gray-500 truncate">{handle}</span>
              <span className="text-gray-500">·</span>
              <span className="text-gray-500">{timestamp}</span>
              <div className="ml-auto">
                <MoreHorizontal className="w-4 h-4 text-gray-500" />
              </div>
            </div>

            {/* Content */}
            <div className="mt-1 text-white text-[15px] leading-normal whitespace-pre-wrap break-words">
              {content || <span className="text-gray-500 italic">Your post content will appear here...</span>}
            </div>

            {/* Image */}
            {imageUrl && (
              <div className="mt-3 rounded-2xl overflow-hidden border border-gray-800">
                <img src={imageUrl} alt="Post attachment" className="w-full max-h-80 object-cover" />
              </div>
            )}

            {/* Engagement Bar */}
            <div className="mt-3 flex items-center justify-between max-w-md text-gray-500">
              <button className="flex items-center gap-2 hover:text-blue-400 transition group">
                <div className="p-2 rounded-full group-hover:bg-blue-400/10">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <span className="text-xs">0</span>
              </button>
              <button className="flex items-center gap-2 hover:text-green-400 transition group">
                <div className="p-2 rounded-full group-hover:bg-green-400/10">
                  <Repeat2 className="w-4 h-4" />
                </div>
                <span className="text-xs">0</span>
              </button>
              <button className="flex items-center gap-2 hover:text-pink-400 transition group">
                <div className="p-2 rounded-full group-hover:bg-pink-400/10">
                  <Heart className="w-4 h-4" />
                </div>
                <span className="text-xs">0</span>
              </button>
              <button className="flex items-center gap-2 hover:text-blue-400 transition group">
                <div className="p-2 rounded-full group-hover:bg-blue-400/10">
                  <Share className="w-4 h-4" />
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ LinkedIn Mockup ============
export function LinkedInPostMockup({ content, imageUrl, userName, timestamp = 'Just now' }: SocialPostMockupProps) {
  const initials = getInitials(userName);
  const displayName = userName.includes('@') ? userName.split('@')[0] : userName;

  return (
    <div className="relative bg-white rounded-xl border border-gray-200 overflow-hidden font-sans text-gray-900 shadow-xl">
      {/* Preview Badge */}
      <div className="absolute top-2 right-2 z-10">
        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-600/10 text-blue-600 uppercase tracking-wider">Preview</span>
      </div>
      {/* Header */}
      <div className="p-4 pb-0">
        <div className="flex gap-3">
          {/* Avatar */}
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-lg">
            {initials}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-semibold text-sm text-gray-900">{displayName}</h4>
                <p className="text-xs text-gray-500">Founder & CEO</p>
                <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                  <span>{timestamp}</span>
                  <span>·</span>
                  <Globe className="w-3 h-3" />
                </div>
              </div>
              <MoreHorizontal className="w-5 h-5 text-gray-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-3">
        <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words">
          {content || <span className="text-gray-400 italic">Your post content will appear here...</span>}
        </div>
      </div>

      {/* Image */}
      {imageUrl && (
        <div className="border-t border-b border-gray-100">
          <img src={imageUrl} alt="Post attachment" className="w-full max-h-96 object-cover" />
        </div>
      )}

      {/* Engagement Stats */}
      <div className="px-4 py-2 flex items-center justify-between text-xs text-gray-500 border-b border-gray-100">
        <div className="flex items-center gap-1">
          <div className="flex -space-x-1">
            <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
              <ThumbsUp className="w-2.5 h-2.5 text-white" />
            </div>
            <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
              <Heart className="w-2.5 h-2.5 text-white" />
            </div>
          </div>
          <span>0</span>
        </div>
        <span>0 comments · 0 reposts</span>
      </div>

      {/* Actions */}
      <div className="px-2 py-1 flex items-center justify-around">
        <button className="flex items-center gap-2 px-4 py-3 text-gray-600 hover:bg-gray-100 rounded-lg transition text-sm font-medium">
          <ThumbsUp className="w-5 h-5" />
          <span>Like</span>
        </button>
        <button className="flex items-center gap-2 px-4 py-3 text-gray-600 hover:bg-gray-100 rounded-lg transition text-sm font-medium">
          <MessageCircle className="w-5 h-5" />
          <span>Comment</span>
        </button>
        <button className="flex items-center gap-2 px-4 py-3 text-gray-600 hover:bg-gray-100 rounded-lg transition text-sm font-medium">
          <Repeat2 className="w-5 h-5" />
          <span>Repost</span>
        </button>
        <button className="flex items-center gap-2 px-4 py-3 text-gray-600 hover:bg-gray-100 rounded-lg transition text-sm font-medium">
          <Send className="w-5 h-5" />
          <span>Send</span>
        </button>
      </div>
    </div>
  );
}

// ============ Facebook Mockup ============
export function FacebookPostMockup({ content, imageUrl, userName, timestamp = 'Just now' }: SocialPostMockupProps) {
  const initials = getInitials(userName);
  const displayName = userName.includes('@') ? userName.split('@')[0] : userName;

  return (
    <div className="relative bg-white rounded-xl border border-gray-200 overflow-hidden font-sans text-gray-900 shadow-xl">
      {/* Preview Badge */}
      <div className="absolute top-2 right-2 z-10">
        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 uppercase tracking-wider">Preview</span>
      </div>
      {/* Header */}
      <div className="p-4 pb-2">
        <div className="flex gap-3">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-lg">
            {initials}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-semibold text-[15px] text-gray-900 hover:underline cursor-pointer">{displayName}</h4>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <span>{timestamp}</span>
                  <span>·</span>
                  <Globe className="w-3 h-3" />
                </div>
              </div>
              <MoreHorizontal className="w-6 h-6 text-gray-400 p-0.5 hover:bg-gray-100 rounded-full cursor-pointer" />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-3">
        <div className="text-[15px] text-gray-900 leading-relaxed whitespace-pre-wrap break-words">
          {content || <span className="text-gray-400 italic">Your post content will appear here...</span>}
        </div>
      </div>

      {/* Image */}
      {imageUrl && (
        <div>
          <img src={imageUrl} alt="Post attachment" className="w-full max-h-[500px] object-cover" />
        </div>
      )}

      {/* Engagement Stats */}
      <div className="px-4 py-2 flex items-center justify-between text-sm text-gray-500 border-b border-gray-200">
        <div className="flex items-center gap-1">
          <div className="flex -space-x-1">
            <div className="w-[18px] h-[18px] rounded-full bg-blue-500 flex items-center justify-center border-2 border-white">
              <ThumbsUp className="w-2.5 h-2.5 text-white" />
            </div>
            <div className="w-[18px] h-[18px] rounded-full bg-red-500 flex items-center justify-center border-2 border-white">
              <Heart className="w-2.5 h-2.5 text-white" />
            </div>
          </div>
          <span className="ml-1">0</span>
        </div>
        <div className="flex gap-3">
          <span className="hover:underline cursor-pointer">0 comments</span>
          <span className="hover:underline cursor-pointer">0 shares</span>
        </div>
      </div>

      {/* Actions */}
      <div className="px-2 py-1 flex items-center justify-around border-b border-gray-200">
        <button className="flex-1 flex items-center justify-center gap-2 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg transition text-sm font-medium">
          <ThumbsUp className="w-5 h-5" />
          <span>Like</span>
        </button>
        <button className="flex-1 flex items-center justify-center gap-2 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg transition text-sm font-medium">
          <MessageCircle className="w-5 h-5" />
          <span>Comment</span>
        </button>
        <button className="flex-1 flex items-center justify-center gap-2 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg transition text-sm font-medium">
          <Share className="w-5 h-5" />
          <span>Share</span>
        </button>
      </div>
    </div>
  );
}

// ============ Instagram Mockup ============
export function InstagramPostMockup({ content, imageUrl, userName, timestamp = 'Just now' }: SocialPostMockupProps) {
  const initials = getInitials(userName);
  const handle = generateHandle(userName);

  return (
    <div className="relative bg-white rounded-xl border border-gray-200 overflow-hidden font-sans text-gray-900 shadow-xl">
      {/* Preview Badge */}
      <div className="absolute top-2 right-10 z-10">
        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-pink-500 uppercase tracking-wider">Preview</span>
      </div>
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center gap-3">
          {/* Avatar with gradient ring */}
          <div className="w-9 h-9 rounded-full p-0.5 bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600 shadow-lg">
            <div className="w-full h-full rounded-full bg-white p-0.5">
              <div className="w-full h-full rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                {initials}
              </div>
            </div>
          </div>
          <span className="font-semibold text-sm">{handle.replace('@', '')}</span>
        </div>
        <MoreHorizontal className="w-5 h-5 text-gray-900" />
      </div>

      {/* Image (required for Instagram) */}
      <div className="aspect-square bg-gray-100 flex items-center justify-center">
        {imageUrl ? (
          <img src={imageUrl} alt="Post" className="w-full h-full object-cover" />
        ) : (
          <div className="text-gray-400 text-sm text-center p-4">
            <div className="text-4xl mb-2">📷</div>
            <p>Add an image to preview your Instagram post</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Heart className="w-6 h-6 hover:text-gray-500 cursor-pointer" />
          <MessageCircle className="w-6 h-6 hover:text-gray-500 cursor-pointer" />
          <Send className="w-6 h-6 hover:text-gray-500 cursor-pointer" />
        </div>
        <Bookmark className="w-6 h-6 hover:text-gray-500 cursor-pointer" />
      </div>

      {/* Likes */}
      <div className="px-4 pb-2">
        <span className="font-semibold text-sm">0 likes</span>
      </div>

      {/* Caption */}
      <div className="px-4 pb-2">
        <p className="text-sm">
          <span className="font-semibold">{handle.replace('@', '')}</span>{' '}
          <span className="whitespace-pre-wrap break-words">
            {content || <span className="text-gray-400 italic">Your caption will appear here...</span>}
          </span>
        </p>
      </div>

      {/* Timestamp */}
      <div className="px-4 pb-4">
        <span className="text-[10px] text-gray-400 uppercase">{timestamp}</span>
      </div>
    </div>
  );
}

// Export a mapping for easy access
export const SocialMockups = {
  twitter: TwitterPostMockup,
  linkedin: LinkedInPostMockup,
  facebook: FacebookPostMockup,
  instagram: InstagramPostMockup,
};
