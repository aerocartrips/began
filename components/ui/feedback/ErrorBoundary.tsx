"use client";

import type { ReactNode } from "react";
import { Component, type ErrorInfo } from "react";
import ErrorCard from "@/components/ui/feedback/ErrorCard";
import Button from "@/components/ui/button";

type ErrorBoundaryProps = {
  children: ReactNode;
  title?: string;
  description?: string;
  onReset?: () => void;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Avoid logging sensitive runtime details to the console in production UI paths.
  }

  private handleReset = () => {
    this.setState({ hasError: false });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorCard
          title={this.props.title ?? "Something went wrong"}
          description={
            this.props.description ??
            "This section could not be displayed. You can try again or return to a safe page."
          }
          action={
            <Button type="button" onClick={this.handleReset}>
              Try again
            </Button>
          }
        />
      );
    }

    return this.props.children;
  }
}
