import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#FEF2F2' }}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
            <View style={{ 
              width: 80, 
              height: 80, 
              borderRadius: 40, 
              backgroundColor: '#FEE2E2', 
              justifyContent: 'center', 
              alignItems: 'center',
              marginBottom: 24 
            }}>
              <Text style={{ fontSize: 40 }}>⚠️</Text>
            </View>
            
            <Text style={{ 
              fontSize: 24, 
              fontWeight: 'bold', 
              color: '#991B1B', 
              textAlign: 'center',
              marginBottom: 12 
            }}>
              Une erreur s&apos;est produite
            </Text>
            
            <Text style={{ 
              fontSize: 16, 
              color: '#B91C1C', 
              textAlign: 'center',
              marginBottom: 24,
              paddingHorizontal: 16 
            }}>
              {this.state.error?.message || 'Erreur inconnue'}
            </Text>
            
            <TouchableOpacity
              onPress={this.handleReset}
              style={{
                backgroundColor: '#DC2626',
                paddingHorizontal: 24,
                paddingVertical: 12,
                borderRadius: 8,
              }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>
                Réessayer
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
