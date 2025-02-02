import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { useQuery } from '@tanstack/react-query';
import { fetchWhaleActivity } from '@/lib/api';

export function WhaleActivity() {
  const { data: activities, isLoading } = useQuery({
    queryKey: ['whaleActivity'],
    queryFn: fetchWhaleActivity,
    refetchInterval: 30000,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Whale Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {activities?.map((activity) => (
              <div key={activity.id} className="flex justify-between text-sm">
                <span>{activity.type}</span>
                <span>{activity.amount}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
