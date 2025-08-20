&lt;template&gt;
  &lt;div class="network-health-indicator" :class="healthStatusClass"&gt;
    &lt;div class="health-status-icon"&gt;
      &lt;i :class="statusIconClass"&gt;&lt;/i&gt;
    &lt;/div&gt;
    
    &lt;div class="health-details" v-if="showDetails"&gt;
      &lt;div class="health-summary"&gt;
        &lt;span class="status-text"&gt;{{ statusText }}&lt;/span&gt;
        &lt;span class="latency" v-if="metrics.isOnline"&gt;{{ metrics.latency }}ms&lt;/span&gt;
      &lt;/div&gt;
      
      &lt;div class="circuit-breakers" v-if="Object.keys(circuitBreakerStates).length &gt; 0"&gt;
        &lt;div class="breaker-title"&gt;Library Status:&lt;/div&gt;
        &lt;div 
          v-for="[library, state] in Object.entries(circuitBreakerStates)" 
          :key="library"
          class="breaker-item"
          :class="`breaker-${state.state.toLowerCase()}`"
        &gt;
          &lt;span class="library-name"&gt;{{ formatLibraryName(library) }}&lt;/span&gt;
          &lt;span class="breaker-state"&gt;
            {{ formatBreakerState(state.state) }}
            &lt;span v-if="state.state === 'OPEN' && state.nextAttempt &gt; Date.now()" class="retry-time"&gt;
              (retry in {{ formatTimeUntilRetry(state.nextAttempt) }})
            &lt;/span&gt;
          &lt;/span&gt;
        &lt;/div&gt;
      &lt;/div&gt;
      
      &lt;div class="connection-stats" v-if="Object.keys(connectionPools).length &gt; 0"&gt;
        &lt;div class="stats-title"&gt;Connection Health:&lt;/div&gt;
        &lt;div 
          v-for="[hostname, stats] in Object.entries(connectionPools)" 
          :key="hostname"
          class="stats-item"
        &gt;
          &lt;span class="hostname"&gt;{{ hostname }}&lt;/span&gt;
          &lt;span class="response-time"&gt;{{ Math.round(stats.avgResponseTime) }}ms avg&lt;/span&gt;
          &lt;span class="request-count"&gt;{{ stats.totalRequests }} requests&lt;/span&gt;
        &lt;/div&gt;
      &lt;/div&gt;
    &lt;/div&gt;
    
    &lt;div class="health-tooltip" v-if="!showDetails"&gt;
      &lt;div class="tooltip-content"&gt;
        &lt;strong&gt;Network Status: {{ statusText }}&lt;/strong&gt;
        &lt;div v-if="metrics.isOnline"&gt;Latency: {{ metrics.latency }}ms&lt;/div&gt;
        &lt;div v-if="activeCircuitBreakers &gt; 0" class="warning"&gt;
          {{ activeCircuitBreakers }} libraries temporarily unavailable
        &lt;/div&gt;
        &lt;div class="tip"&gt;Click to view detailed network health&lt;/div&gt;
      &lt;/div&gt;
    &lt;/div&gt;
  &lt;/div&gt;
&lt;/template&gt;

&lt;script setup lang="ts"&gt;
import { ref, computed, onMounted, onUnmounted } from 'vue'

interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failures: number;
  lastFailure: number;
  nextAttempt: number;
  successCount: number;
}

interface ConnectionPoolStats {
  activeConnections: number;
  totalRequests: number;
  avgResponseTime: number;
  lastUsed: number;
}

interface NetworkHealthMetrics {
  isOnline: boolean;
  latency: number;
  dnsCacheHitRate: number;
  circuitBreakerStates: Record&lt;string, CircuitBreakerState&gt;;
  connectionPools: Record&lt;string, ConnectionPoolStats&gt;;
}

const showDetails = ref(false)
const metrics = ref&lt;NetworkHealthMetrics&gt;({
  isOnline: true,
  latency: 0,
  dnsCacheHitRate: 0,
  circuitBreakerStates: {},
  connectionPools: {}
})

let updateInterval: NodeJS.Timeout | null = null

// Computed properties
const healthStatusClass = computed(() =&gt; {
  if (!metrics.value.isOnline) return 'health-offline'
  if (activeCircuitBreakers.value &gt; 0) return 'health-degraded'
  if (metrics.value.latency &gt; 2000) return 'health-slow'
  return 'health-good'
})

const statusIconClass = computed(() =&gt; {
  const baseClass = 'fas'
  if (!metrics.value.isOnline) return `${baseClass} fa-exclamation-triangle`
  if (activeCircuitBreakers.value &gt; 0) return `${baseClass} fa-exclamation-circle`
  if (metrics.value.latency &gt; 2000) return `${baseClass} fa-clock`
  return `${baseClass} fa-check-circle`
})

const statusText = computed(() =&gt; {
  if (!metrics.value.isOnline) return 'Offline'
  if (activeCircuitBreakers.value &gt; 0) return 'Degraded'
  if (metrics.value.latency &gt; 2000) return 'Slow'
  return 'Online'
})

const circuitBreakerStates = computed(() =&gt; {
  return metrics.value.circuitBreakerStates || {}
})

const connectionPools = computed(() =&gt; {
  return metrics.value.connectionPools || {}
})

const activeCircuitBreakers = computed(() =&gt; {
  return Object.values(circuitBreakerStates.value).filter(
    state =&gt; state.state === 'OPEN' || state.state === 'HALF_OPEN'
  ).length
})

// Methods
async function updateNetworkHealth() {
  try {
    // Request network health metrics from main process
    const healthData = await window.electronAPI.getNetworkHealth()
    metrics.value = healthData
  } catch (error) {
    console.error('Failed to fetch network health:', error)
    metrics.value.isOnline = false
  }
}

function formatLibraryName(library: string): string {
  const libraryNames: Record&lt;string, string&gt; = {
    'bl': 'British Library',
    'bodleian': 'Bodleian Library',
    'gallica': 'Gallica (BnF)',
    'vatlib': 'Vatican Library',
    'morgan': 'Morgan Library',
    'nypl': 'New York Public Library',
    'parker': 'Parker Library',
    'internet_culturale': 'Internet Culturale',
    'trinity_cam': 'Trinity Cambridge',
    'graz': 'University of Graz',
    // Add more library mappings as needed
  }
  
  return libraryNames[library] || library.charAt(0).toUpperCase() + library.slice(1)
}

function formatBreakerState(state: string): string {
  switch (state) {
    case 'CLOSED': return 'Operational'
    case 'OPEN': return 'Unavailable'
    case 'HALF_OPEN': return 'Testing'
    default: return state
  }
}

function formatTimeUntilRetry(nextAttempt: number): string {
  const secondsUntil = Math.ceil((nextAttempt - Date.now()) / 1000)
  if (secondsUntil &lt;= 0) return 'now'
  if (secondsUntil &lt; 60) return `${secondsUntil}s`
  
  const minutesUntil = Math.ceil(secondsUntil / 60)
  return `${minutesUntil}m`
}

function toggleDetails() {
  showDetails.value = !showDetails.value
}

// Lifecycle
onMounted(() =&gt; {
  updateNetworkHealth()
  updateInterval = setInterval(updateNetworkHealth, 5000) // Update every 5 seconds
})

onUnmounted(() =&gt; {
  if (updateInterval) {
    clearInterval(updateInterval)
  }
})
&lt;/script&gt;

&lt;style lang="scss" scoped&gt;
.network-health-indicator {
  position: relative;
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s ease;
  user-select: none;
  
  &amp;:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }
  
  &amp;.health-good {
    background: linear-gradient(135deg, #e8f5e8, #d4edda);
    border: 1px solid #c3e6cb;
    
    .health-status-icon i {
      color: #28a745;
    }
  }
  
  &amp;.health-slow {
    background: linear-gradient(135deg, #fff3cd, #ffeaa7);
    border: 1px solid #ffeaa7;
    
    .health-status-icon i {
      color: #856404;
    }
  }
  
  &amp;.health-degraded {
    background: linear-gradient(135deg, #fff3cd, #ffeaa7);
    border: 1px solid #ffeaa7;
    
    .health-status-icon i {
      color: #856404;
    }
  }
  
  &amp;.health-offline {
    background: linear-gradient(135deg, #f8d7da, #f5c6cb);
    border: 1px solid #f5c6cb;
    
    .health-status-icon i {
      color: #721c24;
    }
  }
}

.health-status-icon {
  margin-right: 8px;
  
  i {
    font-size: 16px;
    animation: pulse 2s infinite ease-in-out;
  }
}

.health-details {
  min-width: 300px;
}

.health-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-weight: 600;
}

.status-text {
  font-size: 14px;
}

.latency {
  font-size: 12px;
  opacity: 0.8;
}

.circuit-breakers,
.connection-stats {
  margin-top: 12px;
}

.breaker-title,
.stats-title {
  font-size: 12px;
  font-weight: 600;
  color: #666;
  margin-bottom: 4px;
}

.breaker-item,
.stats-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 2px 0;
  font-size: 11px;
  
  &amp;.breaker-open {
    color: #dc3545;
    font-weight: 500;
  }
  
  &amp;.breaker-half_open {
    color: #ffc107;
    font-weight: 500;
  }
  
  &amp;.breaker-closed {
    color: #28a745;
  }
}

.library-name,
.hostname {
  font-weight: 500;
}

.breaker-state,
.response-time,
.request-count {
  opacity: 0.8;
}

.retry-time {
  font-style: italic;
  color: #666;
}

.health-tooltip {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s ease;
  z-index: 1000;
  
  &amp;::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 4px solid transparent;
    border-top-color: rgba(0, 0, 0, 0.9);
  }
}

.network-health-indicator:hover .health-tooltip {
  opacity: 1;
}

.tooltip-content {
  text-align: center;
  
  .warning {
    color: #ffc107;
    margin: 2px 0;
  }
  
  .tip {
    opacity: 0.7;
    font-style: italic;
    margin-top: 4px;
  }
}

@keyframes pulse {
  0%, 100% { 
    opacity: 1; 
  }
  50% { 
    opacity: 0.6; 
  }
}
&lt;/style&gt;