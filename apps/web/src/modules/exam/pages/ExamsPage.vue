<script setup lang="ts">
import type { StudentExamListItem } from '@exam/contracts'
import { computed, onMounted, onScopeDispose, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/modules/auth'
import { useAction } from '@/shared/lib/use-action'
import { AppButton } from '@/shared/ui'
import { listPackageIds } from '@/modules/offline'
import { isNetworkError } from '@/shared/lib/http'
import { useStored } from '@/shared/lib/stored'
import { listExams } from '../api'
import { preloadPackages } from '../preload'
import FinishedList from '../components/FinishedList.vue'
import HomeHero from '../components/HomeHero.vue'
import UpcomingCard from '../components/UpcomingCard.vue'
import { attemptPath } from '../paths'

/** The student's home: a greeting, the exam to take now, what comes next and what is done. */
const router = useRouter()
const auth = useAuthStore()
const exams = ref<StudentExamListItem[] | null>(null)
const load = useAction()
const now = ref(Date.now())
const clock = setInterval(() => (now.value = Date.now()), 1000)
onScopeDispose(() => clearInterval(clock))
// The last list is kept on the device: with no network the student still finds the exam and starts it
// from its downloaded package. `ready`: exams that can start without network here.
const cached = useStored<StudentExamListItem[] | null>(`exams:list:${auth.user?.id}`, null)
const fromCache = ref(false)
const ready = ref(new Set<string>())
const refresh = () =>
  load.run(async () => {
    try {
      exams.value = await listExams()
      cached.value = exams.value
      fromCache.value = false
      ready.value = await preloadPackages(exams.value)
    } catch (error) {
      if (!isNetworkError(error) || !cached.value) throw error
      exams.value = cached.value
      fromCache.value = true
      ready.value = new Set(await listPackageIds())
    }
  })
onMounted(refresh)

const firstName = computed(() => auth.user?.name.split(' ')[0] ?? '')
const running = (e: StudentExamListItem) => e.attempt && ['active', 'terminated'].includes(e.attempt.status)
const open = computed(() =>
  (exams.value ?? []).filter(
    (e) => running(e) || (!e.attempt && e.opensAt <= now.value && now.value < e.closesAt),
  ),
)
const upcoming = computed(() => (exams.value ?? []).filter((e) => !e.attempt && now.value < e.opensAt))
const finished = computed(() =>
  (exams.value ?? []).filter((e) => (e.attempt && !running(e)) || (!e.attempt && now.value >= e.closesAt)),
)

function go(exam: StudentExamListItem) {
  void router.push(exam.attempt ? attemptPath(exam.attempt.id, exam.mode) : `/exams/${exam.id}/preflight`)
}
</script>

<template>
  <main class="home">
    <header>
      <h1>{{ $t('student.hello', { name: firstName }) }}</h1>
      <p class="muted lead">
        {{ open.length ? $t('student.openNow', { n: open.length }) : $t('student.nothingOpen') }}
      </p>
    </header>
    <p v-if="load.error.value" class="error" role="alert">
      {{ $t(load.error.value) }}
      <AppButton variant="ghost" @click="refresh">{{ $t('common.retry') }}</AppButton>
    </p>

    <p v-if="fromCache" class="cached" role="status">{{ $t('student.cached') }}</p>
    <template v-if="exams">
      <div class="stagger heroes">
        <HomeHero
          v-for="exam in open"
          :key="exam.id"
          :exam="exam"
          :now="now"
          :offline-ready="ready.has(exam.id)"
          @go="go(exam)"
        />
      </div>
      <div v-if="upcoming.length || finished.length" class="grid stagger">
        <UpcomingCard
          v-for="exam in upcoming"
          :key="exam.id"
          :exam="exam"
          :now="now"
          :offline-ready="ready.has(exam.id)"
        />
        <FinishedList v-if="finished.length" :exams="finished" />
      </div>
      <p v-if="!exams.length" class="empty muted">{{ $t('student.empty') }}</p>
    </template>
  </main>
</template>

<style scoped>
.cached {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius);
  background: var(--warn-tint);
  color: var(--warn);
  font-size: var(--text-sm);
  font-weight: 600;
}
.home,
.heroes {
  display: grid;
  gap: var(--space-6);
}
.heroes {
  gap: var(--space-4);
}
h1 {
  font-size: clamp(var(--text-2xl), 5vw, 3.5rem);
}
.lead {
  margin-top: var(--space-2);
  font-size: var(--text-lg);
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-4);
}
.empty {
  padding: var(--space-8);
  border: 2px dashed var(--border);
  border-radius: var(--radius-lg);
  text-align: center;
}
.error {
  color: var(--danger);
}
</style>
