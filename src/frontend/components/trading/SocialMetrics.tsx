import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { useQuery } from '@tanstack/react-query';
import { fetchSocialMetrics } from '@/lib/api';

export function SocialMetrics() {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['socialMetrics'],
    queryFn: fetchSocialMetrics,
    refetchInterval: 60000,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Social Metrics</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between">
              <span>Twitter Mentions</span>
              <span>{metrics?.twitterMentions}</span>
            </div>
            <div className="flex justify-between">
              <span>Reddit Score</span>
              <span>{metrics?.redditScore}</span>
            </div>
            <div className="flex justify-between">
              <span>Telegram Activity</span>
              <span>{metrics?.telegramActivity}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
