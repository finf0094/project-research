<script setup lang="ts">
import { computed, onMounted, ref, watch, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { AppButton, CheckList } from '@/shared/ui'
import { useDeviceProbe } from '../device-probe'

const emit = defineEmits<{ ready: [ready: boolean] }>()
const { t } = useI18n()
const probe = useDeviceProbe()
const { state, start } = probe

const video = ref<HTMLVideoElement>()
watchEffect(() => {
  if (video.value) video.value.srcObject = probe.stream.value
})
watch(probe.ready, (ready) => emit('ready', ready), { immediate: true })
onMounted(start)

const items = computed(() =>
  probe.checks.value.map((c) => ({
    id: c.id,
    ok: c.ok,
    title: t(`proctoring.check.${c.id}`),
    hint: c.ok ? undefined : t(`proctoring.check.hint.${c.hint}`),
  })),
)
</script>

<template>
  <div class="device-check">
    <div class="frame">
      <video ref="video" muted playsinline autoplay aria-hidden="true" />
      <p v-if="state !== 'running'" class="overlay">
        <template v-if="state === 'blocked'">{{ $t('proctoring.check.blocked') }}</template>
        <template v-else>{{ $t('proctoring.camera.starting') }}</template>
      </p>
    </div>
    <CheckList :items="items" />
    <AppButton v-if="state === 'blocked'" variant="ink" @click="start">{{
      $t('proctoring.check.again')
    }}</AppButton>
  </div>
</template>

<style scoped>
.device-check {
  display: grid;
  gap: var(--space-4);
}
.frame {
  position: relative;
  overflow: hidden;
  aspect-ratio: 16 / 9;
  border-radius: var(--radius);
  background: var(--ink);
}
video {
  inline-size: 100%;
  block-size: 100%;
  object-fit: cover;
  transform: scaleX(-1);
}
.overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: var(--space-4);
  color: var(--on-ink-2);
  text-align: center;
}
</style>
