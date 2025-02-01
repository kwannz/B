'use client';

import { Box, Typography, Button, Card, CardContent } from '@mui/material';

interface AgentCardProps {
  type: 'trading';
  title: string;
  description: string;
  onSelect: () => void;
  disabled?: boolean;
}

export default function AgentCard({ type, title, description, onSelect, disabled }: AgentCardProps) {
  return (
    <Card className={`transition-all hover:shadow-lg ${disabled && 'opacity-50'}`}>
      <CardContent className="space-y-4">
        <Typography variant="h6">{title}</Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
        <Box className="flex justify-between items-center">
          <Button
            variant="contained"
            color="primary"
            onClick={onSelect}
            disabled={disabled}
            size="large"
          >
            Select
          </Button>
          <Button
            variant="text"
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              window.open(`/docs/${type}-agent`, '_blank');
            }}
          >
            Learn More
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}
