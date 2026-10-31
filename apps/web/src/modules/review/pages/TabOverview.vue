<script setup lang="ts">
import CountdownCard from '../components/CountdownCard.vue'
import ExamFacts from '../components/ExamFacts.vue'
import ObservationCard from '../components/ObservationCard.vue'
import ReadinessCard from '../components/ReadinessCard.vue'
import { useExamHub } from '../exam-hub'

/** The exam before and around its time: countdown, readiness, facts and what supervision means. */
const { exam, now } = useExamHub()
</script>

<template>
  <div v-if="exam" class="overview">
    <div class="top">
      <CountdownCard :exam="exam" :now="now" />
      <ReadinessCard :exam="exam" />
    </div>
    <ExamFacts :exam="exam" />
    <ObservationCard :exam="exam" />
  </div>
</template>

<style scoped>
.overview,
.top {
  display: grid;
  gap: var(--space-4);
}
.top {
  grid-template-columns: minmax(0, 1.6fr) minmax(280px, 1fr);
}
@media (width < 1000px) {
  .top {
    grid-template-columns: 1fr;
  }
}
</style>
