import React from "react";

interface LoadingMessageProps {
  dotColor?: string;
}

const LoadingMessage: React.FC<LoadingMessageProps> = ({ dotColor = "bg-gray-400" }) => {
  return (
    <div className="text-sm">
      <div className="flex flex-col">
        <div className="flex">
          <div className="mr-4 rounded-[16px] px-4 py-3 md:mr-24">
            <div className="flex items-center gap-1.5 h-3">
              <style jsx>{`
                @keyframes jump {
                  0%, 60%, 100% {
                    transform: translateY(0);
                  }
                  30% {
                    transform: translateY(-6px);
                  }
                }
                .dot {
                  animation: jump 1.4s infinite;
                  display: inline-block;
                }
              `}</style>
              <div 
                className={`dot w-2 h-2 ${dotColor} rounded-full`}
                style={{ animationDelay: '0ms' }}
              />
              <div 
                className={`dot w-2 h-2 ${dotColor} rounded-full`}
                style={{ animationDelay: '200ms' }}
              />
              <div 
                className={`dot w-2 h-2 ${dotColor} rounded-full`}
                style={{ animationDelay: '400ms' }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingMessage;